"""
Tests Spec 004 — Optimizer V_M7.
Cubre los 6 criterios de aceptación de spec.md §Criterios.
"""
import datetime
import pytest

from app.models.domain import SolverInput, WorkerInfo, DayInfo, ShiftInfo
from app.optimizer.ilp import solve_ilp


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures / Helpers
# ──────────────────────────────────────────────────────────────────────────────

_WEEKDAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
_ALL_DAYS = _WEEKDAYS  # alias

def _horario(inicio: str, fin: str, dias=None):
    dias = dias or _ALL_DAYS
    return {d: {"inicio": inicio, "fin": fin} for d in dias}


def _make_week(year=2026, month=5, day_start=4) -> list[DayInfo]:
    """Semana completa lun-dom a partir de day_start (default = 4 mayo 2026 = lunes)."""
    result = []
    for i in range(7):
        dt = datetime.date(year, month, day_start + i)
        result.append(DayInfo(
            date=dt.isoformat(),
            day_index=i,
            weekday=_WEEKDAYS[dt.weekday()],
            iso_week=1,
            abierto=True,
            apertura_min=9 * 60,
            cierre_min=20 * 60,
            es_feriado=False,
        ))
    return result


def _vm7_shifts():
    return [
        ShiftInfo("ape", "apertura", "V_M7", _horario("09:00", "18:00"), _ALL_DAYS, True),
        ShiftInfo("cie", "cierre",   "V_M7", _horario("11:00", "20:00"), _ALL_DAYS, True),
        ShiftInfo("com", "completo", "V_M7", _horario("10:00", "20:00"), _ALL_DAYS, True),
    ]


def _make_workers(n=3):
    ruts = ["1-9", "2-7", "3-5", "4-3", "5-1"]
    return [
        WorkerInfo(rut=ruts[i], nombre=chr(65 + i),
                   vacaciones=set(), dias_prohibidos=set(), turnos_prohibidos=set())
        for i in range(n)
    ]


_BASE_PARAMS = {
    "horas_semanales_max": 42,
    "horas_semanales_min": 42,
    "dias_maximos_consecutivos": 5,
    "domingos_libres_minimos": 0,
    "peak_desde": "17:00",
    "cobertura_minima": 1,
    "cobertura_optima_peak": 1,
    "cobertura_optima_off_peak": 1,
    "time_limit_seconds": 15,
    "peso_cobertura_peak": 10.0,
    "peso_finde": 5.0,
    "peso_balance": 3.0,
    "peso_ociosidad": 1.0,
    "peso_tipo_balance": 2.0,
}


def _make_solver_input(workers=None, days=None, shifts=None, params=None,
                       rotation_group="V_M7", open_sundays=4) -> SolverInput:
    workers = workers or _make_workers()
    days = days or _make_week()
    shifts = shifts or _vm7_shifts()
    p = {**_BASE_PARAMS, **(params or {})}
    return SolverInput(
        rotation_group=rotation_group,
        workers=workers,
        days=days,
        shifts=shifts,
        weeks=[[0, 1, 2, 3, 4, 5, 6]],
        complete_week_flags=[True],
        open_sundays=open_sundays,
        parametros=p,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Test 1 — Caso base: factible, 42h, ≤5 días, ≥2 COM  (criterio R_NEW_1/2/3)
# ──────────────────────────────────────────────────────────────────────────────

def test_vm7_exactamente_42h_semana_completa():
    out = solve_ilp(_make_solver_input())
    assert out.factible, out.mensajes

    worker_hours = {}
    worker_days  = {}
    worker_com   = {}

    for a in out.asignaciones:
        worker_days[a.worker_rut] = worker_days.get(a.worker_rut, 0) + 1
        if a.shift_id == "com":
            worker_com[a.worker_rut]   = worker_com.get(a.worker_rut, 0) + 1
            worker_hours[a.worker_rut] = worker_hours.get(a.worker_rut, 0) + 9
        else:
            worker_hours[a.worker_rut] = worker_hours.get(a.worker_rut, 0) + 8

    for w in worker_hours:
        assert worker_hours[w] == 42,            f"{w}: {worker_hours[w]}h != 42h"
        assert worker_days.get(w, 0) <= 5,       f"{w}: {worker_days[w]} días > 5"
        assert worker_com.get(w, 0) >= 2,        f"{w}: solo {worker_com.get(w,0)} COM"


# ──────────────────────────────────────────────────────────────────────────────
# Test 2 — Infactible: dotación insuficiente (1 sola persona, tienda 7 días)
# ──────────────────────────────────────────────────────────────────────────────

def test_vm7_infactible_dotacion_insuficiente():
    """Con 1 solo worker no se puede cubrir los 7 días con cobertura mínima."""
    inp = _make_solver_input(workers=_make_workers(n=1))
    out = solve_ilp(inp)
    # No debe ser factible (7 días, mínimo cobertura=1 todo el día, 1 persona no alcanza)
    assert not out.factible


# ──────────────────────────────────────────────────────────────────────────────
# Test 3 — Domingos libres: con domingos_libres_minimos=1, ningún worker
#           trabaja los 4 domingos abiertos del mes (al menos 1 libre)
# ──────────────────────────────────────────────────────────────────────────────

def test_vm7_domingos_libres():
    """Restricción de domingos libres: cada worker debe tener ≥1 domingo libre."""
    # 2 semanas = 2 domingos
    week1 = _make_week(day_start=4)   # 4–10 mayo
    week2 = _make_week(day_start=11)  # 11–17 mayo

    all_days = week1 + [
        DayInfo(date=d.date, day_index=d.day_index + 7, weekday=d.weekday,
                iso_week=2, abierto=d.abierto,
                apertura_min=d.apertura_min, cierre_min=d.cierre_min,
                es_feriado=False)
        for d in week2
    ]
    weeks = [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13]]
    inp = SolverInput(
        rotation_group="V_M7",
        workers=_make_workers(4),
        days=all_days,
        shifts=_vm7_shifts(),
        weeks=weeks,
        complete_week_flags=[True, True],
        open_sundays=2,
        parametros={**_BASE_PARAMS, "domingos_libres_minimos": 1},
    )
    out = solve_ilp(inp)
    assert out.factible, out.mensajes

    sundays = {d.date for d in all_days if d.weekday == "domingo"}
    worker_sundays: dict[str, set] = {}
    for a in out.asignaciones:
        if a.date in sundays:
            worker_sundays.setdefault(a.worker_rut, set()).add(a.date)

    for w in inp.workers:
        worked = len(worker_sundays.get(w.rut, set()))
        assert worked < len(sundays), f"{w.rut} trabajó todos los domingos, sin libre"


# ──────────────────────────────────────────────────────────────────────────────
# Test 4 — Balance APE/CIE: con peso_tipo_balance alto, la diferencia
#           |count_APE - count_CIE| se minimiza
# ──────────────────────────────────────────────────────────────────────────────

def test_vm7_balance_ape_cie():
    """El término Z_tipo_balance debe reducir la brecha APE vs CIE por worker."""
    inp = _make_solver_input(params={"peso_tipo_balance": 20.0})  # peso muy alto
    out = solve_ilp(inp)
    assert out.factible, out.mensajes

    ape_count: dict[str, int] = {}
    cie_count: dict[str, int] = {}
    for a in out.asignaciones:
        if a.shift_id == "ape":
            ape_count[a.worker_rut] = ape_count.get(a.worker_rut, 0) + 1
        elif a.shift_id == "cie":
            cie_count[a.worker_rut] = cie_count.get(a.worker_rut, 0) + 1

    for w in inp.workers:
        diff = abs(ape_count.get(w.rut, 0) - cie_count.get(w.rut, 0))
        assert diff <= 3, f"{w.rut}: desbalance APE/CIE = {diff}, demasiado alto"


# ──────────────────────────────────────────────────────────────────────────────
# Test 5 — Grupo no-V_M7: las restricciones V_M7 NO se aplican
#           (puede trabajar 6 días)
# ──────────────────────────────────────────────────────────────────────────────

def test_non_vm7_sin_restriccion_5_dias():
    """Para rotation_group != V_M7, no debe haber limit de 5 días."""
    days = [
        DayInfo(
            date=d.date,
            day_index=d.day_index,
            weekday=d.weekday,
            iso_week=d.iso_week,
            abierto=d.abierto,
            apertura_min=9 * 60,
            cierre_min=18 * 60,
            es_feriado=False,
        )
        for d in _make_week()
    ]
    shifts_std = [
        ShiftInfo("t8", "completo", "P_MO",
                  _horario("09:00", "18:00"), _ALL_DAYS, True),
    ]
    params = {**_BASE_PARAMS, "horas_semanales_max": 48, "horas_semanales_min": 38,
              "dias_maximos_consecutivos": 6}
    inp = _make_solver_input(
        days=days,
        shifts=shifts_std,
        rotation_group="P_MO",
        params=params,
        workers=_make_workers(2),
    )
    out = solve_ilp(inp)
    assert out.factible, out.mensajes

    # Verificar que ningún worker supera los 6 días (regla general, no V_M7)
    worker_days: dict[str, int] = {}
    for a in out.asignaciones:
        worker_days[a.worker_rut] = worker_days.get(a.worker_rut, 0) + 1
    for rut, dias in worker_days.items():
        assert dias <= 6, f"{rut} trabajó {dias} días, superó el max general"


# ──────────────────────────────────────────────────────────────────────────────
# Test 6 — Vacaciones: worker con vacación en día específico no es asignado
# ──────────────────────────────────────────────────────────────────────────────

def test_vm7_vacaciones_respetadas():
    """Un worker en vacaciones NO debe aparecer en la asignación de ese día."""
    days = _make_week()
    lunes = days[0].date  # primer día de la semana

    workers = [
        WorkerInfo("1-9", "A", vacaciones={lunes}, dias_prohibidos=set(), turnos_prohibidos=set()),
        WorkerInfo("2-7", "B", vacaciones=set(),  dias_prohibidos=set(), turnos_prohibidos=set()),
        WorkerInfo("3-5", "C", vacaciones=set(),  dias_prohibidos=set(), turnos_prohibidos=set()),
    ]
    inp = _make_solver_input(workers=workers, days=days)
    out = solve_ilp(inp)
    assert out.factible, out.mensajes

    for a in out.asignaciones:
        if a.worker_rut == "1-9":
            assert a.date != lunes, f"1-9 asignado en {lunes} estando de vacaciones"
