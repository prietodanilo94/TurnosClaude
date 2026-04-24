"""
Solver ILP basado en OR-Tools CP-SAT.
Implementa las restricciones de docs/math-formulation.md §3 y usa los
builders de app.optimizer.objective para la funcion objetivo combinada.
"""
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Dict, FrozenSet, Iterable, List, Mapping, Optional, Tuple

from ortools.sat.python import cp_model

from app.core.calendar import parse_time
from app.models.domain import AssignmentResult, DayInfo, ShiftInfo, SolverInput, SolverOutput, WorkerInfo
from app.optimizer.partial import PartialContext
from app.optimizer.objective import (
    CoverageSlotKey,
    WorkerDayKey,
    build_balance_term,
    build_idleness_term,
    build_peak_coverage_term,
    build_weekend_term,
    build_shift_type_balance_term,
)

DEFAULT_PEAK_REWARD_CAP = 3


def _safe_name(prefix: str, *parts: object) -> str:
    raw = "__".join([prefix, *[str(part) for part in parts]])
    return raw.replace("-", "_").replace(":", "_").replace(" ", "_")


def _shift_times(shift: ShiftInfo, day: DayInfo) -> Tuple[int, int]:
    """Retorna (inicio_min, fin_min) para el día dado, o (0,0) si no aplica."""
    if day.weekday not in shift.dias_aplicables:
        return 0, 0
    horario = shift.horario_por_dia.get(day.weekday)
    if not horario:
        return 0, 0
    return parse_time(horario["inicio"]), parse_time(horario["fin"])

def _shift_minutes(shift: ShiftInfo, day: DayInfo) -> int:
    inicio, fin = _shift_times(shift, day)
    duracion = fin - inicio
    if shift.descuenta_colacion and duracion >= 360: # 6 horas o mas
        duracion -= 60
    return duracion


def _scale_weights(values: Iterable[float]) -> int:
    decimals = [
        max(0, -Decimal(str(value)).as_tuple().exponent)
        for value in values
    ]
    return 10 ** max(decimals, default=0)


def _slot_range(day: DayInfo) -> range:
    return range(day.apertura_min, day.cierre_min, 30)


def _is_shift_assignable(day: DayInfo, shift: ShiftInfo) -> bool:
    # Si no aplica para este día, rechazar rápido
    if day.weekday not in shift.dias_aplicables:
        return False
    inicio, fin = _shift_times(shift, day)
    if inicio == 0 and fin == 0:
        return False
    # El turno debe comenzar cuando la sucursal ya está abierta,
    # pero puede terminar después del cierre (tareas de cierre).
    return inicio >= day.apertura_min and fin > day.apertura_min


def _build_assignment_vars(
    model: cp_model.CpModel,
    workers: List[WorkerInfo],
    open_days: List[DayInfo],
    shifts: List[ShiftInfo],
    range_dates: Optional[frozenset] = None,
) -> Dict[Tuple[str, str, str], cp_model.IntVar]:
    x: Dict[Tuple[str, str, str], cp_model.IntVar] = {}

    for worker in workers:
        for day in open_days:
            if range_dates is not None and day.date not in range_dates:
                continue  # fuera del rango parcial — no se optimiza
            if day.date in worker.vacaciones or day.weekday in worker.dias_prohibidos:
                continue

            for shift in shifts:
                if shift.id in worker.turnos_prohibidos:
                    continue
                if not _is_shift_assignable(day, shift):
                    continue

                x[(worker.rut, day.date, shift.id)] = model.NewBoolVar(
                    _safe_name("x", worker.rut, day.date, shift.id)
                )

    return x


def _build_day_worked_vars(
    model: cp_model.CpModel,
    workers: List[WorkerInfo],
    open_days: List[DayInfo],
    shifts: List[ShiftInfo],
    x: Mapping[Tuple[str, str, str], cp_model.IntVar],
) -> Dict[WorkerDayKey, cp_model.IntVar]:
    worked: Dict[WorkerDayKey, cp_model.IntVar] = {}

    for worker in workers:
        for day in open_days:
            key = (worker.rut, day.date)
            worked[key] = model.NewBoolVar(_safe_name("y", worker.rut, day.date))

            day_shift_vars = [
                x[(worker.rut, day.date, shift.id)]
                for shift in shifts
                if (worker.rut, day.date, shift.id) in x
            ]

            model.Add(cp_model.LinearExpr.Sum(day_shift_vars) <= 1)
            model.Add(worked[key] == cp_model.LinearExpr.Sum(day_shift_vars))

    return worked


def _build_coverage_vars(
    model: cp_model.CpModel,
    workers: List[WorkerInfo],
    open_days: List[DayInfo],
    shifts: List[ShiftInfo],
    x: Mapping[Tuple[str, str, str], cp_model.IntVar],
    cobertura_minima: int,
) -> Dict[CoverageSlotKey, cp_model.IntVar]:
    coverage: Dict[CoverageSlotKey, cp_model.IntVar] = {}
    max_coverage = len(workers)

    for day in open_days:
        for slot_minute in _slot_range(day):
            key = (day.date, slot_minute)
            slot_var = model.NewIntVar(0, max_coverage, _safe_name("cov", day.date, slot_minute))

            covering_assignments = []
            for worker in workers:
                for shift in shifts:
                    x_key = (worker.rut, day.date, shift.id)
                    if x_key in x:
                        inicio, fin = _shift_times(shift, day)
                        if inicio <= slot_minute < fin:
                            covering_assignments.append(x[x_key])

            model.Add(slot_var == cp_model.LinearExpr.Sum(covering_assignments))
            model.Add(slot_var >= cobertura_minima)
            coverage[key] = slot_var

    return coverage


def _add_weekly_constraints(
    model: cp_model.CpModel,
    inp: SolverInput,
    x: Mapping[Tuple[str, str, str], cp_model.IntVar],
    worked: Mapping[WorkerDayKey, cp_model.IntVar],
    partial_context: Optional[PartialContext] = None,
) -> None:
    day_by_index = {idx: day for idx, day in enumerate(inp.days)}
    shift_by_id = {shift.id: shift for shift in inp.shifts}
    horas_max_minutos = int(round(inp.parametros["horas_semanales_max"] * 60))
    horas_min_minutos = int(round(inp.parametros.get("horas_semanales_min", inp.parametros["horas_semanales_max"]) * 60))
    dias_maximos = int(inp.parametros["dias_maximos_consecutivos"])

    for worker in inp.workers:
        for week_idx, week in enumerate(inp.weeks, start=1):
            wi = week_idx - 1  # índice 0-based

            weekly_assignments = []
            weekly_days = []
            for day_idx in week:
                day = day_by_index[day_idx]
                if not day.abierto:
                    continue

                weekly_days.append(worked[(worker.rut, day.date)])
                for shift in inp.shifts:
                    key = (worker.rut, day.date, shift.id)
                    if key in x:
                        weekly_assignments.append(_shift_minutes(shift_by_id[shift.id], day) * x[key])



            # Descontar horas/días ya consumidos por assignments fijas fuera del rango
            if partial_context is not None:
                fixed_h_min = int(round(
                    partial_context.fixed_hours_by_worker_week
                    .get(worker.rut, {}).get(wi, 0.0) * 60
                ))
                fixed_d = (
                    partial_context.fixed_days_by_worker_week
                    .get(worker.rut, {}).get(wi, 0)
                )
            else:
                fixed_h_min = fixed_d = 0

            # Determinar si aplicar igualdad (solo en optimización completa, no parcial)
            is_complete = (
                wi < len(inp.complete_week_flags) and inp.complete_week_flags[wi]
            )

            # R_NEW_3: Obligar a al menos 2 COM semanales si la semana es completa y rotation_group V_M7
            if getattr(inp, "rotation_group", "") == "V_M7" and is_complete:
                com_shifts = []
                for day_idx in week:
                    d_obj = day_by_index[day_idx]
                    for shift in inp.shifts:
                        if getattr(shift, "nombre_turno", "") == "completo" and (worker.rut, d_obj.date, shift.id) in x:
                            com_shifts.append(x[(worker.rut, d_obj.date, shift.id)])
                if com_shifts:
                    model.Add(cp_model.LinearExpr.Sum(com_shifts) >= 2)
            carryover_h = inp.first_week_carryover.get(worker.rut, 0.0) if wi == 0 else 0.0
            carryover_min = int(round(carryover_h * 60))
            has_carryover = wi == 0 and carryover_h > 0.0

            target_max = max(0, horas_max_minutos - fixed_h_min - carryover_min)
            target_min = max(0, horas_min_minutos - fixed_h_min - carryover_min)

            if weekly_assignments and (is_complete or has_carryover):
                # Semana completa: rango [min, max] siempre, incluso en recálculo parcial
                model.Add(cp_model.LinearExpr.Sum(weekly_assignments) >= target_min)
                model.Add(cp_model.LinearExpr.Sum(weekly_assignments) <= target_max)
            elif weekly_assignments:
                # Semana incompleta (primera/última parcial): solo cap máximo
                model.Add(
                    cp_model.LinearExpr.Sum(weekly_assignments)
                    <= max(0, horas_max_minutos - fixed_h_min)
                )

            model.Add(
                cp_model.LinearExpr.Sum(weekly_days)
                <= max(0, dias_maximos - fixed_d)
            )


def _add_sunday_constraints(
    model: cp_model.CpModel,
    inp: SolverInput,
    worked: Mapping[WorkerDayKey, cp_model.IntVar],
) -> None:
    if inp.open_sundays <= 0:
        return

    sunday_dates = [day.date for day in inp.days if day.abierto and day.weekday == "domingo"]
    required_free = max(1, min(int(inp.parametros["domingos_libres_minimos"]), inp.open_sundays - 1))
    max_worked_sundays = inp.open_sundays - required_free

    for worker in inp.workers:
        sunday_work = [worked[(worker.rut, date_str)] for date_str in sunday_dates]
        model.Add(cp_model.LinearExpr.Sum(sunday_work) <= max_worked_sundays)


def _add_consecutive_constraints(
    model: cp_model.CpModel,
    inp: SolverInput,
    worked: Mapping[WorkerDayKey, cp_model.IntVar],
    partial_context: Optional[PartialContext] = None,
) -> None:
    """
    Restricción real de días consecutivos usando ventana deslizante de (dias_max+1) días.

    Para cada ventana de (dias_maximos+1) días calendario consecutivos, el trabajador
    puede trabajar como máximo dias_maximos de ellos. Esto garantiza que en ningún
    punto del mes haya una racha de más de dias_maximos días seguidos, incluyendo
    los cruces entre semanas ISO.

    Reemplaza el enfoque anterior (suma por semana ISO) que no capturaba los cruces.
    """
    dias_maximos = int(inp.parametros["dias_maximos_consecutivos"])
    window_size = dias_maximos + 1  # e.g. 7 para max 6 consecutivos

    # Fechas trabajadas fijas (asignaciones fuera del rango parcial)
    fixed_worked_dates: Dict[str, set] = {}
    if partial_context is not None:
        for assignment in partial_context.fixed_assignments:
            if assignment.date not in partial_context.range_dates:
                rut = assignment.worker_rut
                if rut not in fixed_worked_dates:
                    fixed_worked_dates[rut] = set()
                fixed_worked_dates[rut].add(assignment.date)

    all_open_days = sorted(
        [d for d in inp.days if d.abierto],
        key=lambda d: d.date,
    )

    if len(all_open_days) < window_size:
        return

    for worker in inp.workers:
        worker_fixed = fixed_worked_dates.get(worker.rut, set())

        for start_idx, start_day in enumerate(all_open_days):
            start_date = datetime.date.fromisoformat(start_day.date)
            end_date = start_date + datetime.timedelta(days=window_size - 1)

            window_vars: List[cp_model.IntVar] = []
            window_fixed = 0

            for day in all_open_days[start_idx:]:
                day_date = datetime.date.fromisoformat(day.date)
                if day_date > end_date:
                    break
                key = (worker.rut, day.date)
                if key in worked:
                    window_vars.append(worked[key])
                elif day.date in worker_fixed:
                    window_fixed += 1

            if not window_vars:
                continue

            budget = max(0, dias_maximos - window_fixed)
            model.Add(cp_model.LinearExpr.Sum(window_vars) <= budget)


def _add_rest_constraints(
    model: cp_model.CpModel,
    open_days: List[DayInfo],
    workers: List[WorkerInfo],
    shifts: List[ShiftInfo],
    x: Mapping[Tuple[str, str, str], cp_model.IntVar],
) -> None:
    ordered_days = sorted(open_days, key=lambda day: day.day_index)

    for previous_day, next_day in zip(ordered_days, ordered_days[1:]):
        # Solo aplicar entre días calendariamente adyacentes.
        # Si hay un día cerrado entre medio el descanso real es >= 24h y la
        # restricción sería falso positivo.
        prev_date = datetime.date.fromisoformat(previous_day.date)
        next_date = datetime.date.fromisoformat(next_day.date)
        if (next_date - prev_date).days != 1:
            continue

        for worker in workers:
            for shift_prev in shifts:
                key_prev = (worker.rut, previous_day.date, shift_prev.id)
                if key_prev not in x:
                    continue

                for shift_next in shifts:
                    key_next = (worker.rut, next_day.date, shift_next.id)
                    if key_next not in x:
                        continue

                    inicio_next, _ = _shift_times(shift_next, next_day)
                    _, fin_prev = _shift_times(shift_prev, previous_day)
                    rest_minutes = (24 * 60 - fin_prev) + inicio_next
                    if rest_minutes < 600:
                        model.Add(x[key_prev] + x[key_next] <= 1)


def solve_ilp(
    inp: SolverInput,
    excluded_fingerprints: Optional[List[FrozenSet[Tuple[str, str, str]]]] = None,
    partial_context: Optional[PartialContext] = None,
) -> SolverOutput:
    model = cp_model.CpModel()
    open_days = [day for day in inp.days if day.abierto]

    range_dates = partial_context.range_dates if partial_context is not None else None
    x = _build_assignment_vars(model, inp.workers, open_days, inp.shifts, range_dates=range_dates)
    worked = _build_day_worked_vars(model, inp.workers, open_days, inp.shifts, x)

    # Diversidad: la nueva solución debe diferir en al menos 1 asignación
    # de cada solución ya encontrada.
    for prev_fp in (excluded_fingerprints or []):
        prev_keys = [key for key in prev_fp if key in x]
        if prev_keys:
            model.Add(
                cp_model.LinearExpr.Sum([x[k] for k in prev_keys]) <= len(prev_keys) - 1
            )

    # Para cobertura mínima, solo los días del rango (los de afuera ya tienen assignments fijas)
    coverage_days = (
        [d for d in open_days if d.date in partial_context.range_dates]
        if partial_context is not None else open_days
    )
    coverage = _build_coverage_vars(
        model=model,
        workers=inp.workers,
        open_days=coverage_days,
        shifts=inp.shifts,
        x=x,
        cobertura_minima=int(inp.parametros["cobertura_minima"]),
    )

    _add_weekly_constraints(model, inp, x, worked, partial_context=partial_context)
    _add_sunday_constraints(model, inp, worked)
    _add_consecutive_constraints(model, inp, worked, partial_context=partial_context)

    if inp.parametros.get("descanso_entre_jornadas", False):
        _add_rest_constraints(model, open_days, inp.workers, inp.shifts, x)

    weekday_by_date = {day.date: day.weekday for day in inp.days}
    peak_start_minute = parse_time(inp.parametros["peak_desde"])

    worker_hours: Dict[str, cp_model.IntVar] = {}
    max_total_minutes = 0
    for worker in inp.workers:
        max_worker_minutes = sum(
            _shift_minutes(shift, day)
            for day in open_days
            for shift in inp.shifts
            if (worker.rut, day.date, shift.id) in x
        )
        max_total_minutes += max_worker_minutes
        worker_hours[worker.rut] = model.NewIntVar(0, max_worker_minutes, _safe_name("hours", worker.rut))
        worker_assignment_minutes = [
            _shift_minutes(shift, day) * x[(worker.rut, day.date, shift.id)]
            for day in open_days
            for shift in inp.shifts
            if (worker.rut, day.date, shift.id) in x
        ]
        model.Add(
            worker_hours[worker.rut]
            == cp_model.LinearExpr.Sum(worker_assignment_minutes)
        )

    total_hours = model.NewIntVar(0, max_total_minutes, "total_hours")
    model.Add(total_hours == cp_model.LinearExpr.Sum(list(worker_hours.values())))

    desired_coverage = {
        key: (
            int(inp.parametros["cobertura_optima_peak"])
            if key[1] >= peak_start_minute
            else int(inp.parametros["cobertura_optima_off_peak"])
        )
        for key in coverage
    }

    # Contar los tipos de turno para el balance
    ape_counts: Dict[str, cp_model.IntVar] = {}
    cie_counts: Dict[str, cp_model.IntVar] = {}
    for worker in inp.workers:
        max_ape = len(open_days)
        max_cie = len(open_days)
        ape_var = model.NewIntVar(0, max_ape, _safe_name("ape_count", worker.rut))
        cie_var = model.NewIntVar(0, max_cie, _safe_name("cie_count", worker.rut))
        
        ape_assignments = []
        cie_assignments = []
        for day in open_days:
            for shift in inp.shifts:
                if (worker.rut, day.date, shift.id) in x:
                    if shift.nombre_turno == "apertura":
                        ape_assignments.append(x[(worker.rut, day.date, shift.id)])
                    elif shift.nombre_turno == "cierre":
                        cie_assignments.append(x[(worker.rut, day.date, shift.id)])
                        
        model.Add(ape_var == cp_model.LinearExpr.Sum(ape_assignments))
        model.Add(cie_var == cp_model.LinearExpr.Sum(cie_assignments))
        
        ape_counts[worker.rut] = ape_var
        cie_counts[worker.rut] = cie_var

    peak_term, _ = build_peak_coverage_term(
        model=model,
        coverage_by_slot=coverage,
        peak_start_minute=peak_start_minute,
        coverage_cap=DEFAULT_PEAK_REWARD_CAP,
    )
    weekend_term = build_weekend_term(worked, weekday_by_date)
    balance_term, _ = build_balance_term(
        model=model,
        worker_hours=worker_hours,
        total_hours=total_hours,
        num_workers=len(inp.workers),
    )
    idleness_term, _, _ = build_idleness_term(
        model=model,
        coverage_by_slot=coverage,
        desired_coverage_by_slot=desired_coverage,
    )

    type_balance_term, _ = build_shift_type_balance_term(
        model=model,
        ape_counts=ape_counts,
        cie_counts=cie_counts,
    )

    peso_tipo_balance = float(inp.parametros.get("peso_tipo_balance", 2.0))

    weight_values = [
        float(inp.parametros["peso_cobertura_peak"]),
        float(inp.parametros["peso_finde"]),
        float(inp.parametros["peso_balance"]),
        float(inp.parametros["peso_ociosidad"]),
        peso_tipo_balance,
    ]
    scale = _scale_weights(weight_values)
    objective = cp_model.LinearExpr.Sum(
        [
            int(Decimal(str(inp.parametros["peso_cobertura_peak"])) * scale) * peak_term,
            int(Decimal(str(inp.parametros["peso_finde"])) * scale) * weekend_term,
            int(Decimal(str(inp.parametros["peso_balance"])) * scale) * balance_term,
            int(Decimal(str(inp.parametros["peso_ociosidad"])) * scale) * idleness_term,
            int(Decimal(str(peso_tipo_balance)) * scale) * type_balance_term,
        ]
    )
    model.Maximize(objective)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(inp.parametros["time_limit_seconds"])

    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        status_name = solver.StatusName(status)
        return SolverOutput(
            factible=False,
            asignaciones=[],
            score=0.0,
            mensajes=[f"Solver ILP sin solucion factible: {status_name}"],
        )

    assignments: List[AssignmentResult] = []
    for worker in inp.workers:
        for day in open_days:
            for shift in inp.shifts:
                key = (worker.rut, day.date, shift.id)
                if key in x and solver.BooleanValue(x[key]):
                    assignments.append(
                        AssignmentResult(
                            worker_rut=worker.rut,
                            date=day.date,
                            shift_id=shift.id,
                        )
                    )

    return SolverOutput(
        factible=True,
        asignaciones=assignments,
        score=solver.ObjectiveValue() / scale,
        mensajes=[f"ILP status: {solver.StatusName(status)}"],
    )
