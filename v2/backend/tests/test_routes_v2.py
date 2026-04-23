from dataclasses import dataclass
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api import routes
from app.main import app
from app.models.domain import SolverInput, WorkerInfo
from app.services.appwrite_jwt import AppwriteUser


@dataclass
class BranchManagerStub:
    branch_id: str


def _set_current_user(user: AppwriteUser) -> None:
    app.dependency_overrides[routes.require_auth] = lambda: user


def _clear_dependency_overrides() -> None:
    app.dependency_overrides.clear()


def _partial_payload(workers_excluidos: list[str]) -> dict:
    weekdays = [
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo",
    ]
    franja = {day: {"apertura": "10:00", "cierre": "20:00"} for day in weekdays}
    horario = {day: {"inicio": "10:00", "fin": "19:00"} for day in weekdays}
    return {
        "branch": {
            "id": "branch_1",
            "codigo_area": "107",
            "nombre": "Movicenter",
            "tipo_franja": "movicenter",
        },
        "rotation_group": "V_M7",
        "month": {"year": 2026, "month": 5},
        "workers": [
            {"rut": "1-9", "nombre": "Andrea", "constraints": []},
            {"rut": "2-7", "nombre": "Bruno", "constraints": []},
        ],
        "holidays": [],
        "shift_catalog": [
            {
                "id": "ape",
                "nombre_display": "Apertura corta",
                "rotation_group": "V_M7",
                "nombre_turno": "apertura",
                "horario_por_dia": horario,
                "descuenta_colacion": True,
                "dias_aplicables": weekdays,
            }
        ],
        "franja_por_dia": franja,
        "carryover_horas": {},
        "parametros": {
            "modo": "greedy",
            "num_propuestas": 1,
            "horas_semanales_max": 42,
            "horas_semanales_min": 41,
            "horas_semanales_obj": 42,
            "dias_maximos_consecutivos": 5,
            "domingos_libres_minimos": 2,
            "peak_desde": "17:00",
            "cobertura_minima": 1,
            "cobertura_optima_peak": 1,
            "cobertura_optima_off_peak": 1,
            "priorizar_fin_de_semana": True,
            "time_limit_seconds": 10,
            "descanso_entre_jornadas": False,
            "peso_cobertura_peak": 10,
            "peso_finde": 5,
            "peso_balance": 3,
            "peso_ociosidad": 1,
        },
        "partial_range": {"desde": "2026-05-05", "hasta": "2026-05-07"},
        "assignments_fijas": [],
        "workers_excluidos": workers_excluidos,
    }


def _minimal_solver_input() -> SolverInput:
    return SolverInput(
        rotation_group="V_M7",
        workers=[
            WorkerInfo(rut="1-9", nombre="Andrea"),
            WorkerInfo(rut="2-7", nombre="Bruno"),
        ],
        days=[],
        shifts=[],
        weeks=[],
        open_sundays=0,
        parametros={},
    )


def test_export_forbids_jefe_without_branch_access(monkeypatch):
    _set_current_user(AppwriteUser(id="user_1", email="jefe@example.com", labels=["jefesucursal"]))

    async def fake_get_proposal(_proposal_id: str):
        return SimpleNamespace(branch_id="branch_1")

    async def fake_list_managers(_user_id: str):
        return [BranchManagerStub(branch_id="branch_2")]

    monkeypatch.setattr(routes.ac, "get_proposal", fake_get_proposal)
    monkeypatch.setattr(routes.ac, "list_branch_managers_by_user", fake_list_managers)

    with TestClient(app) as client:
        response = client.post("/api/export", json={"proposal_id": "prop_1"})

    assert response.status_code == 403
    assert response.json()["detail"] == "No tenés acceso a exportar esta sucursal"
    _clear_dependency_overrides()


def test_export_returns_404_when_dataset_is_missing(monkeypatch):
    _set_current_user(AppwriteUser(id="admin_1", email="admin@example.com", labels=["admin"]))

    async def fake_fetch_export_dataset(_proposal_id: str):
        raise KeyError("missing")

    monkeypatch.setattr(routes, "fetch_export_dataset", fake_fetch_export_dataset)

    with TestClient(app) as client:
        response = client.post("/api/export", json={"proposal_id": "prop_404"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Propuesta no encontrada"
    _clear_dependency_overrides()


def test_export_returns_422_when_dataset_is_invalid(monkeypatch):
    _set_current_user(AppwriteUser(id="admin_1", email="admin@example.com", labels=["admin"]))

    async def fake_fetch_export_dataset(_proposal_id: str):
        raise routes.ExportError("La propuesta tiene slots sin asignar")

    monkeypatch.setattr(routes, "fetch_export_dataset", fake_fetch_export_dataset)

    with TestClient(app) as client:
        response = client.post("/api/export", json={"proposal_id": "prop_invalid"})

    assert response.status_code == 422
    assert response.json()["detail"] == "La propuesta tiene slots sin asignar"
    _clear_dependency_overrides()


def test_export_returns_xlsx_for_admin(monkeypatch):
    _set_current_user(AppwriteUser(id="admin_1", email="admin@example.com", labels=["admin"]))

    async def fake_fetch_export_dataset(_proposal_id: str):
        return SimpleNamespace(resolved_assignments=[SimpleNamespace(worker_id="worker_1")])

    async def fake_create_audit_log(**_kwargs):
        return None

    monkeypatch.setattr(routes, "fetch_export_dataset", fake_fetch_export_dataset)
    monkeypatch.setattr(routes, "export_proposal_to_xlsx", lambda _dataset: b"xlsx-content")
    monkeypatch.setattr(routes, "build_filename", lambda _dataset: "turnos.xlsx")
    monkeypatch.setattr(routes.ac, "create_audit_log", fake_create_audit_log)

    with TestClient(app) as client:
        response = client.post("/api/export", json={"proposal_id": "prop_ok"})

    assert response.status_code == 200
    assert response.content == b"xlsx-content"
    assert response.headers["content-type"] == routes._XLSX_MIME
    assert 'filename="turnos.xlsx"' in response.headers["content-disposition"]
    _clear_dependency_overrides()


def test_optimize_partial_returns_422_when_all_workers_are_excluded(monkeypatch):
    monkeypatch.setattr(routes, "build_solver_input", lambda _payload: _minimal_solver_input())
    monkeypatch.setattr(routes, "setup_partial_problem", lambda _payload, _inp: None)

    with TestClient(app) as client:
        response = client.post("/api/optimize/partial", json=_partial_payload(["1-9", "2-7"]))

    assert response.status_code == 422
    assert response.json()["detail"] == "No hay trabajadores disponibles en el rango parcial."
