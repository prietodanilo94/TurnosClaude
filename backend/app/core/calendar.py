from __future__ import annotations

import calendar as _cal
from datetime import date, timedelta
from typing import Dict, List, Optional

from app.models.domain import DayInfo, ShiftInfo, SolverInput, WorkerInfo
from app.models.schemas import FranjaDia, OptimizeRequest, TipoConstraint

_WEEKDAY_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def parse_time(s: str) -> int:
    """Convierte "HH:MM" a minutos desde 00:00."""
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def weekday_name(d: date) -> str:
    """Nombre del día en español. lunes=0 ... domingo=6."""
    return _WEEKDAY_ES[d.weekday()]


def dias_del_mes(year: int, month: int) -> List[date]:
    num_days = _cal.monthrange(year, month)[1]
    return [date(year, month, day) for day in range(1, num_days + 1)]


def iso_weeks_of_days(days: List[date]) -> List[List[int]]:
    """
    Agrupa los índices 0-based de `days` por semana ISO (lunes-domingo).
    Devuelve lista de grupos en orden cronológico.
    """
    seen: Dict[tuple, List[int]] = {}
    for i, d in enumerate(days):
        key = d.isocalendar()[:2]  # (iso_year, iso_week)
        seen.setdefault(key, []).append(i)
    return list(seen.values())


def build_solver_input(request: OptimizeRequest) -> SolverInput:
    year = request.month.year
    month = request.month.month
    holidays_set = set(request.holidays)
    franja = request.franja_por_dia

    all_dates = dias_del_mes(year, month)

    days: List[DayInfo] = []
    for i, d in enumerate(all_dates):
        wname = weekday_name(d)
        date_str = d.isoformat()
        es_feriado = date_str in holidays_set

        franja_dia: Optional[FranjaDia] = franja.get(wname)
        if franja_dia is None or franja_dia.apertura is None or es_feriado:
            abierto, apertura_min, cierre_min = False, 0, 0
        else:
            abierto = True
            apertura_min = parse_time(franja_dia.apertura)
            cierre_min = parse_time(franja_dia.cierre)

        days.append(DayInfo(
            date=date_str,
            day_index=i + 1,
            weekday=wname,
            iso_week=d.isocalendar()[1],
            abierto=abierto,
            apertura_min=apertura_min,
            cierre_min=cierre_min,
            es_feriado=es_feriado,
        ))

    weeks = iso_weeks_of_days(all_dates)
    open_sundays = sum(1 for d in days if d.weekday == "domingo" and d.abierto)

    shifts: List[ShiftInfo] = []
    for s in request.shift_catalog:
        shifts.append(ShiftInfo(
            id=s.id,
            inicio_min=parse_time(s.inicio),
            fin_min=parse_time(s.fin),
            duracion_h=s.duracion_minutos / 60.0,
        ))

    workers: List[WorkerInfo] = []
    for w in request.workers:
        vacaciones: set = set()
        dias_prohibidos: set = set()
        turnos_prohibidos: set = set()

        for c in w.constraints:
            if c.tipo == TipoConstraint.vacaciones and c.desde and c.hasta:
                cur = date.fromisoformat(c.desde)
                end = date.fromisoformat(c.hasta)
                while cur <= end:
                    vacaciones.add(cur.isoformat())
                    cur += timedelta(days=1)
            elif c.tipo == TipoConstraint.dia_prohibido and c.valor:
                dias_prohibidos.add(c.valor)
            elif c.tipo == TipoConstraint.turno_prohibido and c.valor:
                turnos_prohibidos.add(c.valor)

        workers.append(WorkerInfo(
            rut=w.rut,
            nombre=w.nombre,
            vacaciones=vacaciones,
            dias_prohibidos=dias_prohibidos,
            turnos_prohibidos=turnos_prohibidos,
        ))

    return SolverInput(
        workers=workers,
        days=days,
        shifts=shifts,
        weeks=weeks,
        open_sundays=open_sundays,
        parametros=request.parametros.model_dump(),
    )
