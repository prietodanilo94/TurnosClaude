from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

from app.core.calendar import build_solver_input
from app.models.domain import AssignmentResult, SolverInput
from app.models.schemas import AssignmentOut, OptimizeRequest, Violacion


def _normalize_assignments(
    solucion: Iterable[AssignmentOut | AssignmentResult],
) -> List[AssignmentResult]:
    normalized: List[AssignmentResult] = []
    for assignment in solucion:
        if isinstance(assignment, AssignmentResult):
            normalized.append(assignment)
        else:
            normalized.append(
                AssignmentResult(
                    worker_rut=assignment.worker_rut,
                    date=assignment.date,
                    shift_id=assignment.shift_id,
                )
            )
    return normalized


def _required_free_sundays(inp: SolverInput) -> int:
    if inp.open_sundays <= 0:
        return 0

    configured = int(inp.parametros.get("domingos_libres_minimos", 2))
    return max(1, min(configured, inp.open_sundays - 1))


def _intervals_cover_open_range(
    intervals: List[Tuple[int, int]],
    apertura: int,
    cierre: int,
) -> bool:
    if apertura >= cierre:
        return True

    usable = sorted(
        (max(start, apertura), min(end, cierre))
        for start, end in intervals
        if end > apertura and start < cierre
    )

    if not usable or usable[0][0] > apertura:
        return False

    covered_until = usable[0][1]
    if covered_until >= cierre:
        return True

    for start, end in usable[1:]:
        if start > covered_until:
            return False
        covered_until = max(covered_until, end)
        if covered_until >= cierre:
            return True

    return covered_until >= cierre


def validar_solucion(
    solucion: Iterable[AssignmentOut | AssignmentResult],
    payload: OptimizeRequest,
) -> List[Violacion]:
    inp = build_solver_input(payload)
    assignments = _normalize_assignments(solucion)

    workers_by_rut = {worker.rut: worker for worker in inp.workers}
    shifts_by_id = {shift.id: shift for shift in inp.shifts}
    days_by_date = {day.date: day for day in inp.days}

    date_to_week_idx: Dict[str, int] = {}
    for week_idx, week in enumerate(inp.weeks):
        for day_idx in week:
            date_to_week_idx[inp.days[day_idx].date] = week_idx

    weekly_hours: Dict[Tuple[str, int], float] = defaultdict(float)
    weekly_days: Dict[Tuple[str, int], set[str]] = defaultdict(set)
    sunday_days_worked: Dict[str, set[str]] = defaultdict(set)
    assignments_by_date: Dict[str, List[AssignmentResult]] = defaultdict(list)
    violations: List[Violacion] = []

    for assignment in assignments:
        worker = workers_by_rut.get(assignment.worker_rut)
        shift = shifts_by_id.get(assignment.shift_id)
        day = days_by_date.get(assignment.date)

        if worker is None or shift is None or day is None:
            continue

        assignments_by_date[assignment.date].append(assignment)

        week_idx = date_to_week_idx[assignment.date]
        weekly_hours[(worker.rut, week_idx)] += shift.duracion_h
        weekly_days[(worker.rut, week_idx)].add(assignment.date)

        if day.weekday == "domingo" and day.abierto:
            sunday_days_worked[worker.rut].add(assignment.date)

        if day.es_feriado:
            violations.append(
                Violacion(
                    tipo="feriado_asignado",
                    worker_rut=worker.rut,
                    detalle=f"{worker.rut} tiene turno asignado en feriado {day.date}.",
                )
            )

        if assignment.date in worker.vacaciones:
            violations.append(
                Violacion(
                    tipo="vacaciones_asignadas",
                    worker_rut=worker.rut,
                    detalle=f"{worker.rut} tiene turno asignado durante vacaciones el {day.date}.",
                )
            )

        if day.weekday in worker.dias_prohibidos:
            violations.append(
                Violacion(
                    tipo="dia_prohibido_asignado",
                    worker_rut=worker.rut,
                    detalle=f"{worker.rut} no puede trabajar los {day.weekday}.",
                )
            )

        if assignment.shift_id in worker.turnos_prohibidos:
            violations.append(
                Violacion(
                    tipo="turno_prohibido_asignado",
                    worker_rut=worker.rut,
                    detalle=f"{worker.rut} no puede hacer el turno {assignment.shift_id}.",
                )
            )

    horas_max = float(inp.parametros.get("horas_semanales_max", 42))
    dias_max = int(inp.parametros.get("dias_maximos_consecutivos", 6))

    for (worker_rut, week_idx), hours in sorted(weekly_hours.items()):
        if hours > horas_max:
            violations.append(
                Violacion(
                    tipo="horas_semanales_excedidas",
                    worker_rut=worker_rut,
                    detalle=(
                        f"{worker_rut} acumula {hours:.2f}h en semana {week_idx + 1}; "
                        f"maximo permitido {horas_max:.2f}h."
                    ),
                )
            )

    for (worker_rut, week_idx), worked_days in sorted(weekly_days.items()):
        if len(worked_days) > dias_max:
            violations.append(
                Violacion(
                    tipo="dias_semanales_excedidos",
                    worker_rut=worker_rut,
                    detalle=(
                        f"{worker_rut} trabaja {len(worked_days)} dias en semana {week_idx + 1}; "
                        f"maximo permitido {dias_max}."
                    ),
                )
            )

    required_free_sundays = _required_free_sundays(inp)
    if required_free_sundays > 0:
        for worker in inp.workers:
            free_sundays = inp.open_sundays - len(sunday_days_worked.get(worker.rut, set()))
            if free_sundays < required_free_sundays:
                violations.append(
                    Violacion(
                        tipo="domingos_libres_insuficientes",
                        worker_rut=worker.rut,
                        detalle=(
                            f"{worker.rut} tiene {free_sundays} domingos libres; "
                            f"minimo requerido {required_free_sundays}."
                        ),
                    )
                )

    for day in inp.days:
        if not day.abierto:
            continue

        intervals = [
            (shifts_by_id[a.shift_id].inicio_min, shifts_by_id[a.shift_id].fin_min)
            for a in assignments_by_date.get(day.date, [])
            if a.shift_id in shifts_by_id
        ]
        if not _intervals_cover_open_range(intervals, day.apertura_min, day.cierre_min):
            violations.append(
                Violacion(
                    tipo="cobertura_insuficiente",
                    detalle=(
                        f"{day.date} no tiene cobertura continua entre "
                        f"{day.apertura_min // 60:02d}:{day.apertura_min % 60:02d} y "
                        f"{day.cierre_min // 60:02d}:{day.cierre_min % 60:02d}."
                    ),
                )
            )

    return violations
