"""
Integración: el optimizador no asigna turnos en días feriados.
"""
from app.core.calendar import build_solver_input
from app.models.schemas import (
    BranchInput,
    FranjaDia,
    MonthInput,
    OptimizeRequest,
    ShiftDef,
    WorkerInput,
)
from app.optimizer.greedy import solve_greedy

_FRANJA = {
    "lunes": FranjaDia(apertura="09:00", cierre="19:00"),
    "martes": FranjaDia(apertura="09:00", cierre="19:00"),
    "miercoles": FranjaDia(apertura="09:00", cierre="19:00"),
    "jueves": FranjaDia(apertura="09:00", cierre="19:00"),
    "viernes": FranjaDia(apertura="09:00", cierre="19:00"),
    "sabado": FranjaDia(apertura="09:00", cierre="14:00"),
    "domingo": None,
}

_SHIFTS = [
    ShiftDef(
        id="S_09_14",
        inicio="09:00",
        fin="14:00",
        duracion_minutos=300,
        descuenta_colacion=False,
    )
]

_WORKERS = [
    WorkerInput(rut=f"1111111{i}-{i}", nombre=f"Worker {i}", constraints=[])
    for i in range(1, 4)
]

_BRANCH = BranchInput(id="b1", codigo_area="TEST", nombre="Test Branch", tipo_franja="standalone")


def _make_request(year: int, month: int, holidays: list[str]) -> OptimizeRequest:
    return OptimizeRequest(
        branch=_BRANCH,
        month=MonthInput(year=year, month=month),
        workers=_WORKERS,
        holidays=holidays,
        shift_catalog=_SHIFTS,
        franja_por_dia=_FRANJA,
    )


def test_no_assignments_on_holiday():
    """1 de mayo es feriado: ningún worker debe tener turno ese día."""
    req = _make_request(2026, 5, holidays=["2026-05-01"])
    result = solve_greedy(build_solver_input(req))

    assigned_dates = {a.date for a in result.asignaciones}
    assert "2026-05-01" not in assigned_dates


def test_assignments_present_without_holiday():
    """Sin feriados, el optimizador genera asignaciones en mayo."""
    req = _make_request(2026, 5, holidays=[])
    result = solve_greedy(build_solver_input(req))

    assert len(result.asignaciones) > 0, "Sin feriados debe haber asignaciones"


def test_multiple_holidays_excluded():
    """18 y 25 de sep son feriados: no deben aparecer asignaciones."""
    req = _make_request(2026, 9, holidays=["2026-09-18", "2026-09-25"])
    result = solve_greedy(build_solver_input(req))

    assigned_dates = {a.date for a in result.asignaciones}
    assert "2026-09-18" not in assigned_dates
    assert "2026-09-25" not in assigned_dates
