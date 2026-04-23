"""
Cálculo de métricas de calidad para una propuesta de turnos.
Spec 010 — Task 2.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from typing import Dict, List

from app.core.calendar import parse_time
from app.models.domain import DayInfo, ShiftInfo, SolverInput, SolverOutput

_SLOT_MIN = 30  # granularidad de cobertura en minutos


@dataclass
class ProposalMetrics:
    score: float
    horas_promedio: float
    desviacion_horas: float
    cobertura_peak_pct: float
    turnos_cortos_count: int
    fin_semana_completo_count: int


def _slots_in_range(start: int, end: int) -> List[int]:
    return list(range(start, end, _SLOT_MIN))


def _workers_in_slot(slot_start: int, date: str,
                     by_date: Dict[str, List[ShiftInfo]],
                     day_map: Dict[str, DayInfo]) -> int:
    cnt = 0
    day = day_map.get(date)
    if not day:
        return 0
    for s in by_date.get(date, []):
        inicio, fin = s.get_times(day.weekday)
        if inicio <= slot_start < fin:
            cnt += 1
    return cnt


def compute_metrics(solution: SolverOutput, inp: SolverInput) -> ProposalMetrics:
    """
    Calcula las 6 métricas de calidad de una propuesta.
    Se invoca una vez por propuesta generada, antes de persistirla.
    """
    shift_map: Dict[str, ShiftInfo] = {s.id: s for s in inp.shifts}
    peak_desde_min: int = parse_time(inp.parametros.get("peak_desde", "17:00"))
    cobertura_minima: int = inp.parametros.get("cobertura_minima", 1)

    horas_por_worker: Dict[str, float] = {w.rut: 0.0 for w in inp.workers}
    by_date: Dict[str, List[ShiftInfo]] = {}
    turnos_cortos = 0

    day_map: Dict[str, DayInfo] = {d.date: d for d in inp.days}
    for asig in solution.asignaciones:
        shift = shift_map.get(asig.shift_id)
        day = day_map.get(asig.date)
        if shift is None or day is None:
            continue
        duracion = shift.get_duracion_h(day.weekday)
        horas_por_worker[asig.worker_rut] = horas_por_worker.get(asig.worker_rut, 0.0) + duracion
        by_date.setdefault(asig.date, []).append(shift)
        if duracion <= 7.0:
            turnos_cortos += 1

    horas_list = list(horas_por_worker.values())
    horas_promedio = statistics.mean(horas_list) if horas_list else 0.0
    desviacion_horas = statistics.pstdev(horas_list) if len(horas_list) > 1 else 0.0

    peak_total = 0
    peak_cubiertos = 0
    for day in inp.days:
        if not day.abierto:
            continue
        peak_start = max(day.apertura_min, peak_desde_min)
        if peak_start >= day.cierre_min:
            continue
        for slot in _slots_in_range(peak_start, day.cierre_min):
            peak_total += 1
            if _workers_in_slot(slot, day.date, by_date, day_map) >= 2:
                peak_cubiertos += 1

    cobertura_peak_pct = (peak_cubiertos / peak_total * 100.0) if peak_total > 0 else 0.0

    fin_semana_completo = 0
    for week_indices in inp.weeks:
        week_days = [inp.days[i] for i in week_indices if i < len(inp.days)]
        weekend = [d for d in week_days if d.weekday in ("sabado", "domingo") and d.abierto]
        if not weekend:
            continue
        completo = all(
            _workers_in_slot(slot, day.date, by_date, day_map) >= cobertura_minima
            for day in weekend
            for slot in _slots_in_range(day.apertura_min, day.cierre_min)
        )
        if completo:
            fin_semana_completo += 1

    return ProposalMetrics(
        score=solution.score,
        horas_promedio=round(horas_promedio, 2),
        desviacion_horas=round(desviacion_horas, 2),
        cobertura_peak_pct=round(cobertura_peak_pct, 1),
        turnos_cortos_count=turnos_cortos,
        fin_semana_completo_count=fin_semana_completo,
    )
