import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.calendar import build_solver_input
from app.core.validators import validar_solucion
from app.main import app
from app.models.schemas import OptimizeRequest
from app.optimizer.ilp import solve_ilp

FIXTURE_DIR = Path(__file__).parent / "fixtures"
client = TestClient(app)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def get_small_ilp_request() -> OptimizeRequest:
    return OptimizeRequest.model_validate(load_fixture("ilp_small_optimal.json"))


def test_ilp_small_fixture_es_factible():
    req = get_small_ilp_request()
    out = solve_ilp(build_solver_input(req))

    assert out.factible, out.mensajes
    assert len(out.asignaciones) == 9
    assert out.score == -10.0


def test_ilp_small_fixture_pasa_validator():
    req = get_small_ilp_request()
    out = solve_ilp(build_solver_input(req))

    violaciones = validar_solucion(out.asignaciones, req)

    assert violaciones == []


def test_ilp_small_fixture_balancea_horas():
    req = get_small_ilp_request()
    out = solve_ilp(build_solver_input(req))
    hours = {worker.rut: 0.0 for worker in build_solver_input(req).workers}
    shift_hours = {shift.id: shift.duracion_h for shift in build_solver_input(req).shifts}

    for assignment in out.asignaciones:
        hours[assignment.worker_rut] += shift_hours[assignment.shift_id]

    assert sorted(hours.values()) == [15.0, 15.0, 15.0]


def test_http_optimize_ilp_devuelve_200():
    payload = load_fixture("ilp_small_optimal.json")
    response = client.post("/optimize", json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["propuestas"][0]["modo"] == "ilp"
    assert body["propuestas"][0]["factible"] is True
    assert len(body["propuestas"][0]["asignaciones"]) == 9
