"""
Heurística Greedy para asignación de turnos.
Sigue el pseudocódigo de docs/math-formulation.md §7.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from app.models.domain import AssignmentResult, DayInfo, ShiftInfo, SolverInput, SolverOutput
from app.optimizer.partial import PartialContext


# ─── helpers ──────────────────────────────────────────────────────────────────

def _minimal_shift_cover(
    shifts: List[ShiftInfo], day: DayInfo
) -> List[ShiftInfo]:
    """
    Cobertura mínima de [apertura, cierre) con los turnos disponibles.
    Greedy: en cada paso escoge el turno que empieza <= covered_until
    y extiende la cobertura más lejos.
    Devuelve lista vacía si hay un gap insalvable.
    """
    candidates = []
    apertura = day.apertura_min
    cierre = day.cierre_min
    for s in shifts:
        inicio, fin = s.get_times(day.weekday)
        if inicio >= apertura and fin > apertura:
            candidates.append((s, inicio, fin))

    cover: List[ShiftInfo] = []
    covered_until = apertura

    while covered_until < cierre:
        # Solo turnos que realmente avanzan la cobertura (evita bucle infinito
        # cuando ningún turno llega más lejos que covered_until).
        eligible = [(s, ini, fini) for s, ini, fini in candidates if ini <= covered_until and fini > covered_until]
        if not eligible:
            break  # gap insalvable — cobertura incompleta
        best_tuple = max(eligible, key=lambda x: x[2])  # escoge el que termina mas tarde
        cover.append(best_tuple[0])
        covered_until = best_tuple[2]

    # Cobertura incompleta: hay un gap entre covered_until y cierre.
    if covered_until < cierre:
        return []
    return cover


def _day_priority(day: DayInfo) -> Tuple[int, int]:
    """
    Prioridad para ordenar días de trabajo:
    sábados y domingos primero (mayor demanda), luego viernes, luego resto.
    """
    if day.weekday in ("sabado", "domingo"):
        return (0, day.day_index)
    if day.weekday == "viernes":
        return (1, day.day_index)
    return (2, day.day_index)


# ─── solver ───────────────────────────────────────────────────────────────────

def solve_greedy(
    inp: SolverInput,
    partial_context: Optional[PartialContext] = None,
) -> SolverOutput:
    workers = inp.workers
    days = inp.days
    shifts = inp.shifts
    weeks = inp.weeks
    params = inp.parametros

    horas_max: float = params["horas_semanales_max"]
    dias_max_semana: int = params.get("max_dias_semana", params["dias_maximos_consecutivos"])
    if getattr(inp, "rotation_group", "") == "V_M7":
        dias_max_semana = min(dias_max_semana, 5)

    # Mapa day_index (0-based) → índice de semana
    day_to_week: Dict[int, int] = {}
    for wi, week in enumerate(weeks):
        for di in week:
            day_to_week[di] = wi

    n_workers = len(workers)
    n_weeks = len(weeks)

    # Pre-inicializar con horas/días ya consumidos fuera del rango (caso parcial)
    horas_semana = [[0.0] * n_weeks for _ in range(n_workers)]
    dias_semana = [[0] * n_weeks for _ in range(n_workers)]
    if partial_context is not None:
        for wix, worker in enumerate(workers):
            for wi in range(n_weeks):
                horas_semana[wix][wi] = (
                    partial_context.fixed_hours_by_worker_week
                    .get(worker.rut, {}).get(wi, 0.0)
                )
                dias_semana[wix][wi] = (
                    partial_context.fixed_days_by_worker_week
                    .get(worker.rut, {}).get(wi, 0)
                )

    # Carryover de mes anterior en la primera semana parcial
    if inp.first_week_carryover:
        for wix, worker in enumerate(workers):
            carry = inp.first_week_carryover.get(worker.rut, 0.0)
            if carry > 0.0:
                horas_semana[wix][0] += carry

    domingos_trabajados = [0] * n_workers

    # Domingos máximos por trabajador (§3.8)
    open_sundays = inp.open_sundays
    if open_sundays > 0:
        max_dom = open_sundays - min(2, open_sundays - 1)
    else:
        max_dom = 0

    # Registro de workers asignados por día para evitar doble asignación
    asignados_por_dia: Dict[str, Set[int]] = {}

    asignaciones: List[AssignmentResult] = []
    mensajes: List[str] = []

    all_open = [d for d in days if d.abierto]
    if partial_context is not None:
        all_open = [d for d in all_open if d.date in partial_context.range_dates]
    open_days = sorted(all_open, key=_day_priority)

    for day in open_days:
        di = day.day_index - 1  # índice 0-based
        wi = day_to_week[di]
        asignados_hoy: Set[int] = asignados_por_dia.setdefault(day.date, set())

        needed = _minimal_shift_cover(shifts, day)

        if not needed:
            mensajes.append(
                f"{day.date}: ningún turno cubre "
                f"{day.apertura_min // 60:02d}:{day.apertura_min % 60:02d}"
                f"-{day.cierre_min // 60:02d}:{day.cierre_min % 60:02d}"
            )
            continue

        for shift in needed:
            eligible = [
                wix
                for wix, w in enumerate(workers)
                if wix not in asignados_hoy
                and day.date not in w.vacaciones
                and day.weekday not in w.dias_prohibidos
                and shift.id not in w.turnos_prohibidos
                and horas_semana[wix][wi] + shift.get_duracion_h(day.weekday) <= horas_max
                and dias_semana[wix][wi] < dias_max_semana
                and (day.weekday != "domingo" or domingos_trabajados[wix] < max_dom)
            ]

            if not eligible:
                mensajes.append(
                    f"{day.date} turno {shift.id}: sin trabajadores disponibles"
                )
                continue

            # Escoge el worker con menos horas acumuladas en la semana (balance §7)
            best_wix = min(eligible, key=lambda w: horas_semana[w][wi])

            asignaciones.append(AssignmentResult(
                worker_rut=workers[best_wix].rut,
                date=day.date,
                shift_id=shift.id,
            ))
            asignados_hoy.add(best_wix)
            horas_semana[best_wix][wi] += shift.get_duracion_h(day.weekday)
            dias_semana[best_wix][wi] += 1
            if day.weekday == "domingo":
                domingos_trabajados[best_wix] += 1

    factible = len(mensajes) == 0

    if partial_context is not None:
        dias_abiertos = sum(1 for d in days if d.abierto and d.date in partial_context.range_dates)
    else:
        dias_abiertos = sum(1 for d in days if d.abierto)
    dias_cubiertos = len({a.date for a in asignaciones})
    score = round((dias_cubiertos / dias_abiertos * 100) if dias_abiertos else 0.0, 2)

    return SolverOutput(
        factible=factible,
        asignaciones=asignaciones,
        score=score,
        mensajes=mensajes,
    )
