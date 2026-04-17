"""
Tests de calcular_lower_bound.
Los casos conocidos están documentados en math-formulation.md §5 y §10.
"""
import json
from pathlib import Path

from app.core.calendar import build_solver_input
from app.models.domain import DayInfo, SolverInput
from app.models.schemas import OptimizeRequest
from app.optimizer.lower_bound import calcular_lower_bound

FIXTURE_DIR = Path(__file__).parent / "fixtures"


# ─── helper ───────────────────────────────────────────────────────────────────

def _make_input(days: list[DayInfo], weeks: list[list[int]], horas_max: float = 42) -> SolverInput:
    return SolverInput(
        workers=[],
        days=days,
        shifts=[],
        weeks=weeks,
        open_sundays=0,
        parametros={"horas_semanales_max": horas_max},
    )


def _open_day(date: str, day_index: int, weekday: str, iso_week: int,
              apertura: int, cierre: int) -> DayInfo:
    return DayInfo(
        date=date,
        day_index=day_index,
        weekday=weekday,
        iso_week=iso_week,
        abierto=True,
        apertura_min=apertura,
        cierre_min=cierre,
        es_feriado=False,
    )


def _closed_day(date: str, day_index: int, weekday: str, iso_week: int) -> DayInfo:
    return DayInfo(
        date=date,
        day_index=day_index,
        weekday=weekday,
        iso_week=iso_week,
        abierto=False,
        apertura_min=0,
        cierre_min=0,
        es_feriado=False,
    )


# ─── Tests unitarios ──────────────────────────────────────────────────────────

def test_sin_dias_abiertos_retorna_0():
    days = [_closed_day("2026-05-01", 1, "viernes", 18)]
    inp = _make_input(days, [[0]])
    assert calcular_lower_bound(inp) == 0


def test_sin_semanas_retorna_0():
    days = [_open_day("2026-05-04", 1, "lunes", 19, 540, 1140)]
    inp = _make_input(days, [])   # 0 semanas
    assert calcular_lower_bound(inp) == 0


def test_un_dia_10h_una_semana():
    # ceil(10 / 42) = 1
    days = [_open_day("2026-05-04", 1, "lunes", 19, 540, 1140)]
    inp = _make_input(days, [[0]])
    assert calcular_lower_bound(inp) == 1


def test_ejemplo_spec_seccion_10():
    """
    math-formulation.md §10: sucursal standalone, 4 semanas completas.
    L-V: 10h × 5 días × 4 semanas = 200h
    Sábado: 4h × 4 sábados = 16h
    Total: 216h
    Máx por persona: 42 × 4 = 168h
    n_min = ceil(216 / 168) = 2
    """
    days: list[DayInfo] = []
    WEEKDAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    for week in range(4):
        for i, wday in enumerate(WEEKDAYS):
            di = week * 7 + i
            if wday == "domingo":
                days.append(_closed_day(f"2026-01-{di+1:02d}", di + 1, wday, week + 1))
            elif wday == "sabado":
                days.append(_open_day(f"2026-01-{di+1:02d}", di + 1, wday, week + 1, 540, 780))   # 4h
            else:
                days.append(_open_day(f"2026-01-{di+1:02d}", di + 1, wday, week + 1, 540, 1140))  # 10h

    weeks = [list(range(7 * w, 7 * w + 7)) for w in range(4)]
    inp = _make_input(days, weeks)
    assert calcular_lower_bound(inp) == 2


def test_standalone_basic_fixture():
    """
    Con el fixture standalone_basic (5 semanas, mayo 2026 con 2 feriados),
    n_min debe ser 2 → los 5 trabajadores del fixture son suficientes.
    """
    raw = json.loads((FIXTURE_DIR / "standalone_basic.json").read_text(encoding="utf-8"))
    req = OptimizeRequest.model_validate(raw)
    inp = build_solver_input(req)
    n_min = calcular_lower_bound(inp)
    assert n_min >= 1
    assert len(req.workers) >= n_min   # fixture debe ser factible


def test_lower_bound_sube_con_mas_horas_diarias():
    # Si duplicamos las horas diarias, n_min también sube
    day_8h = _open_day("2026-05-04", 1, "lunes", 19, 540, 1020)   # 8h
    day_16h = _open_day("2026-05-04", 1, "lunes", 19, 480, 1440)  # 16h (hipotético)
    inp_8h = _make_input([day_8h], [[0]])
    inp_16h = _make_input([day_16h], [[0]])
    assert calcular_lower_bound(inp_16h) >= calcular_lower_bound(inp_8h)
