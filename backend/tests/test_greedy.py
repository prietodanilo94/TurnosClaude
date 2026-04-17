import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.calendar import build_solver_input
from app.main import app
from app.models.schemas import OptimizeRequest
from app.optimizer.greedy import solve_greedy

FIXTURE_DIR = Path(__file__).parent / "fixtures"
client = TestClient(app)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def get_standalone_input():
    raw = load_fixture("standalone_basic.json")
    req = OptimizeRequest.model_validate(raw)
    return build_solver_input(req)


# ─── Tests de solve_greedy ────────────────────────────────────────────────────

def test_standalone_basic_es_factible():
    inp = get_standalone_input()
    out = solve_greedy(inp)
    assert out.factible, f"Infactible: {out.mensajes}"


def test_standalone_todos_los_dias_cubiertos():
    inp = get_standalone_input()
    out = solve_greedy(inp)
    dias_abiertos = {d.date for d in inp.days if d.abierto}
    dias_cubiertos = {a.date for a in out.asignaciones}
    sin_cubrir = dias_abiertos - dias_cubiertos
    assert not sin_cubrir, f"Días sin cubrir: {sorted(sin_cubrir)}"


def test_standalone_sin_exceso_horas_semanales():
    inp = get_standalone_input()
    out = solve_greedy(inp)

    horas_max = inp.parametros["horas_semanales_max"]
    shift_dur = {s.id: s.duracion_h for s in inp.shifts}

    # Mapear fecha → semana ISO (índice en inp.weeks)
    date_to_week_idx: dict = {}
    for wi, week in enumerate(inp.weeks):
        for di in week:
            date_to_week_idx[inp.days[di].date] = wi

    # Acumular horas por (rut, semana)
    horas: dict[tuple, float] = {}
    for a in out.asignaciones:
        key = (a.worker_rut, date_to_week_idx[a.date])
        horas[key] = horas.get(key, 0.0) + shift_dur[a.shift_id]

    violaciones = [(rut, wk, h) for (rut, wk), h in horas.items() if h > horas_max]
    assert not violaciones, f"Horas excedidas: {violaciones}"


def test_standalone_score_entre_0_y_100():
    inp = get_standalone_input()
    out = solve_greedy(inp)
    assert 0.0 <= out.score <= 100.0


def test_standalone_un_turno_por_worker_por_dia():
    inp = get_standalone_input()
    out = solve_greedy(inp)
    seen: set[tuple] = set()
    for a in out.asignaciones:
        key = (a.worker_rut, a.date)
        assert key not in seen, f"Worker {a.worker_rut} asignado dos veces el {a.date}"
        seen.add(key)


# ─── Test HTTP (endpoint /optimize) ──────────────────────────────────────────

def test_http_optimize_greedy_devuelve_200():
    payload = load_fixture("standalone_basic.json")
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["propuestas"]) == 1
    assert body["propuestas"][0]["factible"] is True
    assert body["propuestas"][0]["modo"] == "greedy"
    assert len(body["propuestas"][0]["asignaciones"]) > 0


def test_http_optimize_ilp_devuelve_501():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["modo"] = "ilp"
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 501
