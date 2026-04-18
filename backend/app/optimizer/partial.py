"""
Prepara el contexto para el recálculo parcial (Spec 009).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from app.models.domain import AssignmentResult, SolverInput
from app.models.schemas import PartialOptimizeRequest


@dataclass
class PartialContext:
    """
    Complemento al SolverInput cuando el recálculo es parcial.

    - range_dates: el solver solo crea variables para estas fechas.
    - fixed_*_by_worker_week: horas/días ya consumidos fuera del rango en cada
      semana; se descuentan del presupuesto semanal antes de correr el solver.
    - fixed_assignments: lista plana para devolver en la response junto con las
      nuevas asignaciones del rango.
    """
    range_dates: frozenset[str]
    fixed_hours_by_worker_week: dict[str, dict[int, float]]   # rut → wi → horas
    fixed_days_by_worker_week: dict[str, dict[int, int]]      # rut → wi → días
    fixed_assignments: list[AssignmentResult]


def setup_partial_problem(
    payload: PartialOptimizeRequest,
    solver_input: SolverInput,
) -> PartialContext:
    """
    Calcula el PartialContext desde el payload y el SolverInput completo del mes.

    No modifica solver_input. El llamador filtra workers_excluidos del SolverInput
    antes de pasarlo a los solvers.
    """
    desde = date.fromisoformat(payload.partial_range.desde)
    hasta = date.fromisoformat(payload.partial_range.hasta)

    range_dates: frozenset[str] = frozenset(
        (desde + timedelta(days=i)).isoformat()
        for i in range((hasta - desde).days + 1)
    )

    # fecha → índice de semana (0-based)
    date_to_week_idx: dict[str, int] = {}
    for wi, week in enumerate(solver_input.weeks):
        for di in week:
            date_to_week_idx[solver_input.days[di].date] = wi

    shift_dur: dict[str, float] = {s.id: s.duracion_h for s in solver_input.shifts}

    # Horas y días fijos por worker y semana.
    # Solo las assignments_fijas fuera del rango cuentan como consumo fijo.
    # (Las que caen dentro del rango se ignoran: son las que se van a recalcular.)
    hours: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    days_worked: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    for af in payload.assignments_fijas:
        if af.date in range_dates:
            continue
        wi = date_to_week_idx.get(af.date)
        if wi is None:
            continue
        hours[af.worker_rut][wi] += shift_dur.get(af.shift_id, 0.0)
        days_worked[af.worker_rut][wi] += 1

    return PartialContext(
        range_dates=range_dates,
        fixed_hours_by_worker_week={rut: dict(wmap) for rut, wmap in hours.items()},
        fixed_days_by_worker_week={rut: dict(wmap) for rut, wmap in days_worked.items()},
        fixed_assignments=[
            AssignmentResult(worker_rut=af.worker_rut, date=af.date, shift_id=af.shift_id)
            for af in payload.assignments_fijas
        ],
    )
