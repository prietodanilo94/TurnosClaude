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


def test_http_optimize_ilp_devuelve_200():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["modo"] = "ilp"
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["propuestas"][0]["modo"] == "ilp"
    assert body["propuestas"][0]["factible"] is True


# ─── Tests Task 8: diagnostico con lower bound real ───────────────────────────

def test_http_diagnostico_incluye_n_min():
    payload = load_fixture("standalone_basic.json")
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200
    diag = resp.json()["diagnostico"]
    assert diag["dotacion_minima_requerida"] >= 1
    assert diag["dotacion_disponible"] == 5
    assert diag["dotacion_suficiente"] is True


def test_http_propuesta_dotacion_minima_sugerida():
    payload = load_fixture("standalone_basic.json")
    resp = client.post("/optimize", json=payload)
    prop = resp.json()["propuestas"][0]
    assert prop["dotacion_minima_sugerida"] >= 1


# ─── Tests Task 9: 409 dotación insuficiente ─────────────────────────────────

def test_http_insuficiente_devuelve_409():
    payload = load_fixture("infeasible_short_staff.json")
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 409


def test_http_409_incluye_diagnostico():
    payload = load_fixture("infeasible_short_staff.json")
    resp = client.post("/optimize", json=payload)
    body = resp.json()
    assert "diagnostico" in body
    assert body["diagnostico"]["dotacion_suficiente"] is False
    assert body["diagnostico"]["dotacion_disponible"] == 1
    assert body["diagnostico"]["dotacion_minima_requerida"] >= 2


def test_http_409_mensaje_explicativo():
    payload = load_fixture("infeasible_short_staff.json")
    resp = client.post("/optimize", json=payload)
    body = resp.json()
    assert len(body["diagnostico"]["mensajes"]) > 0
    assert "trabajadores" in body["diagnostico"]["mensajes"][0]


# ─── Tests Task 16: múltiples propuestas ─────────────────────────────────────

def test_http_greedy_devuelve_n_propuestas():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["modo"] = "greedy"
    payload["parametros"]["num_propuestas"] = 3
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200, resp.text
    propuestas = resp.json()["propuestas"]
    assert len(propuestas) == 3


def test_http_greedy_propuestas_son_distintas():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["modo"] = "greedy"
    payload["parametros"]["num_propuestas"] = 3
    resp = client.post("/optimize", json=payload)
    propuestas = resp.json()["propuestas"]
    fingerprints = [
        frozenset((a["worker_rut"], a["date"], a["shift_id"]) for a in p["asignaciones"])
        for p in propuestas
    ]
    assert len(set(fingerprints)) == len(fingerprints), "Hay propuestas duplicadas"


def test_http_ilp_devuelve_n_propuestas_distintas():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["modo"] = "ilp"
    payload["parametros"]["num_propuestas"] = 2
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200, resp.text
    propuestas = resp.json()["propuestas"]
    assert len(propuestas) == 2, f"Esperaba 2 propuestas, got {len(propuestas)}"
    assert all(p["factible"] for p in propuestas)
    fp1 = frozenset((a["worker_rut"], a["date"], a["shift_id"]) for a in propuestas[0]["asignaciones"])
    fp2 = frozenset((a["worker_rut"], a["date"], a["shift_id"]) for a in propuestas[1]["asignaciones"])
    assert fp1 != fp2, "Las dos propuestas ILP son idénticas"


def test_http_propuestas_tienen_ids_distintos():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["num_propuestas"] = 3
    resp = client.post("/optimize", json=payload)
    ids = [p["id"] for p in resp.json()["propuestas"]]
    assert len(set(ids)) == len(ids), "IDs de propuestas duplicados"


def test_http_num_propuestas_1_devuelve_1():
    payload = load_fixture("standalone_basic.json")
    payload["parametros"]["num_propuestas"] = 1
    resp = client.post("/optimize", json=payload)
    assert resp.status_code == 200
    assert len(resp.json()["propuestas"]) == 1
