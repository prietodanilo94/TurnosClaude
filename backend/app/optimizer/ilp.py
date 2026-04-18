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
)

DEFAULT_PEAK_REWARD_CAP = 3


def _safe_name(prefix: str, *parts: object) -> str:
    raw = "__".join([prefix, *[str(part) for part in parts]])
    return raw.replace("-", "_").replace(":", "_").replace(" ", "_")


def _shift_minutes(shift: ShiftInfo) -> int:
    return int(round(shift.duracion_h * 60))


def _scale_weights(values: Iterable[float]) -> int:
    decimals = [
        max(0, -Decimal(str(value)).as_tuple().exponent)
        for value in values
    ]
    return 10 ** max(decimals, default=0)


def _slot_range(day: DayInfo) -> range:
    return range(day.apertura_min, day.cierre_min, 30)


def _is_shift_assignable(day: DayInfo, shift: ShiftInfo) -> bool:
    return shift.inicio_min < day.cierre_min and shift.fin_min > day.apertura_min


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

            covering_assignments = [
                x[(worker.rut, day.date, shift.id)]
                for worker in workers
                for shift in shifts
                if (worker.rut, day.date, shift.id) in x
                and shift.inicio_min <= slot_minute < shift.fin_min
            ]

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
    day_by_index = {day.day_index - 1: day for day in inp.days}
    shift_by_id = {shift.id: shift for shift in inp.shifts}
    horas_max_minutos = int(round(inp.parametros["horas_semanales_max"] * 60))
    dias_maximos = int(inp.parametros["dias_maximos_consecutivos"])

    for worker in inp.workers:
        for week_idx, week in enumerate(inp.weeks, start=1):
            wi = week_idx - 1  # índice 0-based para lookup en partial_context

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
                        weekly_assignments.append(_shift_minutes(shift_by_id[shift.id]) * x[key])

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

                    rest_minutes = (24 * 60 - shift_prev.fin_min) + shift_next.inicio_min
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

    if inp.parametros.get("descanso_entre_jornadas", False):
        _add_rest_constraints(model, open_days, inp.workers, inp.shifts, x)

    weekday_by_date = {day.date: day.weekday for day in inp.days}
    peak_start_minute = parse_time(inp.parametros["peak_desde"])

    worker_hours: Dict[str, cp_model.IntVar] = {}
    max_total_minutes = 0
    for worker in inp.workers:
        max_worker_minutes = sum(
            _shift_minutes(shift)
            for day in open_days
            for shift in inp.shifts
            if (worker.rut, day.date, shift.id) in x
        )
        max_total_minutes += max_worker_minutes
        worker_hours[worker.rut] = model.NewIntVar(0, max_worker_minutes, _safe_name("hours", worker.rut))
        worker_assignment_minutes = [
            _shift_minutes(shift) * x[(worker.rut, day.date, shift.id)]
            for day in open_days
            for shift in inp.shifts
            if (worker.rut, day.date, shift.id) in x
        ]
        model.Add(
            worker_hours[worker.rut]
            == cp_model.LinearExpr.Sum(worker_assignment_minutes)
        )

    total_hours = model.NewIntVar(0, max_total_minutes, "total_hours")
    model.Add(total_hours == cp_model.LinearExpr.Sum(worker_hours.values()))

    desired_coverage = {
        key: (
            int(inp.parametros["cobertura_optima_peak"])
            if key[1] >= peak_start_minute
            else int(inp.parametros["cobertura_optima_off_peak"])
        )
        for key in coverage
    }

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

    weight_values = [
        float(inp.parametros["peso_cobertura_peak"]),
        float(inp.parametros["peso_finde"]),
        float(inp.parametros["peso_balance"]),
        float(inp.parametros["peso_ociosidad"]),
    ]
    scale = _scale_weights(weight_values)
    objective = cp_model.LinearExpr.Sum(
        [
            int(Decimal(str(inp.parametros["peso_cobertura_peak"])) * scale) * peak_term,
            int(Decimal(str(inp.parametros["peso_finde"])) * scale) * weekend_term,
            int(Decimal(str(inp.parametros["peso_balance"])) * scale) * balance_term,
            int(Decimal(str(inp.parametros["peso_ociosidad"])) * scale) * idleness_term,
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
