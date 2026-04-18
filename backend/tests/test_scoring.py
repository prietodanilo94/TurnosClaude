"""
Tests de compute_metrics (scoring.py).
Cada test verifica una sola métrica con datos construidos a mano.
"""
from __future__ import annotations

from app.models.domain import AssignmentResult, DayInfo, ShiftInfo, SolverInput, SolverOutput, WorkerInfo
from app.optimizer.scoring import ProposalMetrics, compute_metrics


# ─── helpers ──────────────────────────────────────────────────────────────────

def _shift(id: str, inicio_h: float, fin_h: float, duracion_h: float) -> ShiftInfo:
    return ShiftInfo(
        id=id,
        inicio_min=int(inicio_h * 60),
        fin_min=int(fin_h * 60),
        duracion_h=duracion_h,
    )


def _day(date: str, weekday: str, apertura_h: float, cierre_h: float,
         abierto: bool = True, iso_week: int = 1) -> DayInfo:
    return DayInfo(
        date=date,
        day_index=1,
        weekday=weekday,
        iso_week=iso_week,
        abierto=abierto,
        apertura_min=int(apertura_h * 60),
        cierre_min=int(cierre_h * 60),
        es_feriado=False,
    )


def _worker(rut: str) -> WorkerInfo:
    return WorkerInfo(rut=rut, nombre="Test")


def _inp(workers, days, shifts, weeks=None, parametros=None) -> SolverInput:
    return SolverInput(
        workers=workers,
        days=days,
        shifts=shifts,
        weeks=weeks or [[0]],
        open_sundays=0,
        parametros=parametros or {"peak_desde": "17:00", "cobertura_minima": 1},
    )


def _solution(score: float, asignaciones) -> SolverOutput:
    return SolverOutput(factible=True, score=score, asignaciones=asignaciones)


def _asig(rut: str, date: str, shift_id: str) -> AssignmentResult:
    return AssignmentResult(worker_rut=rut, date=date, shift_id=shift_id)


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_score_propagado():
    inp = _inp([_worker("11111111-1")], [_day("2026-05-05", "martes", 9, 19)], [_shift("S1", 9, 19, 10)])
    sol = _solution(98.7, [_asig("11111111-1", "2026-05-05", "S1")])
    m = compute_metrics(sol, inp)
    assert m.score == 98.7


def test_horas_promedio_dos_workers():
    # Worker A: 10h, Worker B: 8h → promedio 9h
    shifts = [_shift("S10", 9, 19, 10), _shift("S8", 9, 17, 8)]
    workers = [_worker("A"), _worker("B")]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp(workers, days, shifts)
    sol = _solution(0, [_asig("A", "2026-05-05", "S10"), _asig("B", "2026-05-05", "S8")])
    m = compute_metrics(sol, inp)
    assert m.horas_promedio == 9.0


def test_desviacion_horas_uniforme_es_cero():
    # Ambos workers con el mismo turno → desviación 0
    shifts = [_shift("S10", 9, 19, 10)]
    workers = [_worker("A"), _worker("B")]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp(workers, days, shifts)
    sol = _solution(0, [_asig("A", "2026-05-05", "S10"), _asig("B", "2026-05-05", "S10")])
    m = compute_metrics(sol, inp)
    assert m.desviacion_horas == 0.0


def test_desviacion_horas_con_diferencia():
    # Worker A: 10h, Worker B: 0h → pstdev([10, 0]) = 5.0
    shifts = [_shift("S10", 9, 19, 10)]
    workers = [_worker("A"), _worker("B")]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp(workers, days, shifts)
    sol = _solution(0, [_asig("A", "2026-05-05", "S10")])  # B no trabaja
    m = compute_metrics(sol, inp)
    assert m.desviacion_horas == 5.0


def test_cobertura_peak_cien_pct():
    # Día con peak 17:00-19:00 (4 slots de 30 min), 2 workers asignados todo el día
    shifts = [_shift("S1", 9, 19, 10)]
    workers = [_worker("A"), _worker("B")]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp(workers, days, shifts, parametros={"peak_desde": "17:00", "cobertura_minima": 1})
    sol = _solution(0, [_asig("A", "2026-05-05", "S1"), _asig("B", "2026-05-05", "S1")])
    m = compute_metrics(sol, inp)
    assert m.cobertura_peak_pct == 100.0


def test_cobertura_peak_cero_sin_asignaciones():
    shifts = [_shift("S1", 9, 19, 10)]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp([_worker("A")], days, shifts, parametros={"peak_desde": "17:00", "cobertura_minima": 1})
    sol = _solution(0, [])  # nadie trabaja
    m = compute_metrics(sol, inp)
    assert m.cobertura_peak_pct == 0.0


def test_turnos_cortos_contados():
    # 1 turno de 4h (corto) y 1 turno de 10h (normal)
    shifts = [_shift("S4", 9, 13, 4), _shift("S10", 9, 19, 10)]
    workers = [_worker("A"), _worker("B")]
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp(workers, days, shifts)
    sol = _solution(0, [_asig("A", "2026-05-05", "S4"), _asig("B", "2026-05-05", "S10")])
    m = compute_metrics(sol, inp)
    assert m.turnos_cortos_count == 1


def test_fin_semana_completo_sabado_cubierto():
    # Semana con sábado abierto, cubierto en todos sus slots → 1 fin de semana completo
    shifts = [_shift("S1", 9, 14, 5)]
    workers = [_worker("A")]
    sabado = _day("2026-05-02", "sabado", 9, 14)
    inp = _inp(workers, [sabado], shifts, weeks=[[0]],
               parametros={"peak_desde": "17:00", "cobertura_minima": 1})
    sol = _solution(0, [_asig("A", "2026-05-02", "S1")])
    m = compute_metrics(sol, inp)
    assert m.fin_semana_completo_count == 1


def test_fin_semana_incompleto_sin_cobertura():
    # Sábado abierto pero nadie asignado → 0 fines de semana completos
    shifts = [_shift("S1", 9, 14, 5)]
    workers = [_worker("A")]
    sabado = _day("2026-05-02", "sabado", 9, 14)
    inp = _inp(workers, [sabado], shifts, weeks=[[0]],
               parametros={"peak_desde": "17:00", "cobertura_minima": 1})
    sol = _solution(0, [])
    m = compute_metrics(sol, inp)
    assert m.fin_semana_completo_count == 0


def test_solucion_vacia_retorna_ceros():
    # Sin asignaciones ni workers → todas las métricas en 0
    days = [_day("2026-05-05", "martes", 9, 19)]
    inp = _inp([], days, [])
    sol = _solution(0.0, [])
    m = compute_metrics(sol, inp)
    assert isinstance(m, ProposalMetrics)
    assert m.horas_promedio == 0.0
    assert m.desviacion_horas == 0.0
    assert m.cobertura_peak_pct == 0.0
    assert m.turnos_cortos_count == 0
    assert m.fin_semana_completo_count == 0
