from datetime import date

from app.core.calendar import (
    build_solver_input,
    dias_del_mes,
    iso_weeks_of_days,
    parse_time,
    weekday_name,
)
from app.models.schemas import (
    BranchInput,
    ConstraintInput,
    FranjaDia,
    MonthInput,
    OptimizeRequest,
    Parametros,
    ShiftDef,
    TipoConstraint,
    TipoFranja,
    WorkerInput,
)


def test_parse_time():
    assert parse_time("09:00") == 540
    assert parse_time("17:30") == 1050
    assert parse_time("00:00") == 0
    assert parse_time("23:59") == 1439


def test_weekday_name():
    assert weekday_name(date(2026, 1, 5)) == "lunes"
    assert weekday_name(date(2026, 1, 6)) == "martes"
    assert weekday_name(date(2026, 1, 10)) == "sabado"
    assert weekday_name(date(2026, 1, 11)) == "domingo"


def test_dias_del_mes_mayo_2026():
    days = dias_del_mes(2026, 5)
    assert len(days) == 31
    assert days[0] == date(2026, 5, 1)
    assert days[-1] == date(2026, 5, 31)


def test_dias_del_mes_febrero_bisiesto():
    assert len(dias_del_mes(2024, 2)) == 29


def test_dias_del_mes_febrero_normal():
    assert len(dias_del_mes(2026, 2)) == 28


def test_iso_weeks_cubre_todos_los_dias():
    days = dias_del_mes(2026, 5)
    weeks = iso_weeks_of_days(days)
    all_indices = sorted(i for w in weeks for i in w)
    assert all_indices == list(range(31))


def test_iso_weeks_entre_4_y_6():
    days = dias_del_mes(2026, 5)
    weeks = iso_weeks_of_days(days)
    assert 4 <= len(weeks) <= 6


def _make_request(n_workers: int = 3, year: int = 2026, month: int = 5) -> OptimizeRequest:
    return OptimizeRequest(
        branch=BranchInput(
            id="b1", codigo_area="1", nombre="Test", tipo_franja=TipoFranja.standalone
        ),
        month=MonthInput(year=year, month=month),
        workers=[
            WorkerInput(rut=f"1122{i}333-9", nombre=f"Worker {i}")
            for i in range(1, n_workers + 1)
        ],
        holidays=["2026-05-01"],
        shift_catalog=[
            ShiftDef(id="S1", inicio="09:00", fin="14:00", duracion_minutos=300, descuenta_colacion=False),
            ShiftDef(id="S2", inicio="14:00", fin="19:00", duracion_minutos=300, descuenta_colacion=False),
        ],
        franja_por_dia={
            "lunes":    FranjaDia(apertura="09:00", cierre="19:00"),
            "martes":   FranjaDia(apertura="09:00", cierre="19:00"),
            "miercoles":FranjaDia(apertura="09:00", cierre="19:00"),
            "jueves":   FranjaDia(apertura="09:00", cierre="19:00"),
            "viernes":  FranjaDia(apertura="09:00", cierre="19:00"),
            "sabado":   FranjaDia(apertura="09:00", cierre="14:00"),
            "domingo":  None,
        },
        parametros=Parametros(),
    )


def test_build_solver_input_feriado_cerrado():
    inp = build_solver_input(_make_request())
    may1 = next(d for d in inp.days if d.date == "2026-05-01")
    assert not may1.abierto
    assert may1.es_feriado


def test_build_solver_input_lunes_abierto():
    inp = build_solver_input(_make_request())
    may4 = next(d for d in inp.days if d.date == "2026-05-04")
    assert may4.abierto
    assert may4.weekday == "lunes"
    assert may4.apertura_min == 540    # 09:00
    assert may4.cierre_min == 1140     # 19:00


def test_build_solver_input_domingos_cerrados():
    inp = build_solver_input(_make_request())
    domingos = [d for d in inp.days if d.weekday == "domingo"]
    assert len(domingos) > 0
    assert all(not d.abierto for d in domingos)
    assert inp.open_sundays == 0


def test_build_solver_input_turnos():
    inp = build_solver_input(_make_request())
    assert len(inp.shifts) == 2
    s1 = next(s for s in inp.shifts if s.id == "S1")
    assert s1.inicio_min == 540
    assert s1.fin_min == 840
    assert s1.duracion_h == 5.0


def test_build_solver_input_constraint_vacaciones():
    req = _make_request()
    req.workers[0].constraints = [
        ConstraintInput(tipo=TipoConstraint.vacaciones, desde="2026-05-10", hasta="2026-05-12"),
    ]
    inp = build_solver_input(req)
    w = inp.workers[0]
    assert "2026-05-10" in w.vacaciones
    assert "2026-05-11" in w.vacaciones
    assert "2026-05-12" in w.vacaciones
    assert "2026-05-13" not in w.vacaciones


def test_build_solver_input_constraint_dia_prohibido():
    req = _make_request()
    req.workers[0].constraints = [
        ConstraintInput(tipo=TipoConstraint.dia_prohibido, valor="sabado"),
    ]
    inp = build_solver_input(req)
    assert "sabado" in inp.workers[0].dias_prohibidos


def test_build_solver_input_constraint_turno_prohibido():
    req = _make_request()
    req.workers[0].constraints = [
        ConstraintInput(tipo=TipoConstraint.turno_prohibido, valor="S1"),
    ]
    inp = build_solver_input(req)
    assert "S1" in inp.workers[0].turnos_prohibidos
