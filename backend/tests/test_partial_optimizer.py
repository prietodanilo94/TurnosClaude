"""
Tests spec 009 — recálculo parcial (tasks 5 y 6).

Cubre:
  - POST /optimize/partial: respuesta 200 con assignments solo en el rango
  - Workers excluidos no aparecen en el resultado
  - Horas fijas se descuentan del presupuesto semanal
  - 422 cuando el solver no puede cubrir el rango (infactible)
  - 422 cuando todos los workers están excluidos
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app

# ─── Datos base ───────────────────────────────────────────────────────────────

_SHIFT = {"id": "S_09_19", "inicio": "09:00", "fin": "19:00", "duracion_minutos": 600, "descuenta_colacion": True}

_FRANJA = {
    "lunes":     {"apertura": "09:00", "cierre": "19:00"},
    "martes":    {"apertura": "09:00", "cierre": "19:00"},
    "miercoles": {"apertura": "09:00", "cierre": "19:00"},
    "jueves":    {"apertura": "09:00", "cierre": "19:00"},
    "viernes":   {"apertura": "09:00", "cierre": "19:00"},
    "sabado":    {"apertura": "09:00", "cierre": "14:00"},
    "domingo":   None,
}

_WORKERS = [
    {"rut": "11111111-1", "nombre": "WORKER A", "constraints": []},
    {"rut": "22222222-2", "nombre": "WORKER B", "constraints": []},
    {"rut": "33333333-3", "nombre": "WORKER C", "constraints": []},
]

_RANGE = {"desde": "2026-05-15", "hasta": "2026-05-31"}

_RANGE_DATES = {
    (date(2026, 5, 15) + timedelta(days=i)).isoformat()
    for i in range((date(2026, 5, 31) - date(2026, 5, 15)).days + 1)
}


def _base_payload(**overrides) -> dict:
    payload = {
        "branch": {"id": "b1", "codigo_area": "1200", "nombre": "NISSAN TEST", "tipo_franja": "autopark"},
        "month": {"year": 2026, "month": 5},
        "workers": _WORKERS,
        "holidays": ["2026-05-01", "2026-05-21"],
        "shift_catalog": [_SHIFT],
        "franja_por_dia": _FRANJA,
        "parametros": {"modo": "greedy", "num_propuestas": 1, "horas_semanales_max": 42, "cobertura_minima": 1},
        "partial_range": _RANGE,
        "assignments_fijas": [],
        "workers_excluidos": [],
    }
    payload.update(overrides)
    return payload


# ─── Fixture ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ─── Task 5: comportamiento básico del endpoint ───────────────────────────────

class TestOptimizePartialBasico:

    def test_200_y_shape_response(self, client):
        resp = client.post("/optimize/partial", json=_base_payload())
        assert resp.status_code == 200
        data = resp.json()
        assert "propuestas" in data
        assert "diagnostico" in data
        assert len(data["propuestas"]) >= 1

    def test_assignments_solo_dentro_del_rango(self, client):
        resp = client.post("/optimize/partial", json=_base_payload())
        asigs = resp.json()["propuestas"][0]["asignaciones"]
        for a in asigs:
            assert a["date"] in _RANGE_DATES, (
                f"Assignment fuera del rango: {a['date']}"
            )

    def test_ninguna_assignment_fuera_del_rango(self, client):
        resp = client.post("/optimize/partial", json=_base_payload())
        asigs = resp.json()["propuestas"][0]["asignaciones"]
        fuera = [a for a in asigs if a["date"] not in _RANGE_DATES]
        assert fuera == [], f"Assignments fuera del rango: {fuera}"

    def test_worker_excluido_no_aparece_en_rango(self, client):
        payload = _base_payload(workers_excluidos=["33333333-3"])
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 200
        asigs = resp.json()["propuestas"][0]["asignaciones"]
        ruts_en_resultado = {a["worker_rut"] for a in asigs}
        assert "33333333-3" not in ruts_en_resultado

    def test_proposal_id_tiene_prefijo_partial(self, client):
        resp = client.post("/optimize/partial", json=_base_payload())
        pid = resp.json()["propuestas"][0]["id"]
        assert pid.startswith("prop_partial_")

    def test_diagnostico_dotacion_excluye_workers_excluidos(self, client):
        payload = _base_payload(workers_excluidos=["33333333-3"])
        resp = client.post("/optimize/partial", json=payload)
        diag = resp.json()["diagnostico"]
        assert diag["dotacion_disponible"] == 2  # 3 workers - 1 excluido

    def test_assignments_fijas_no_en_response(self, client):
        """Las assignments fijas no se incluyen en la response — el frontend las fusiona."""
        fijas = [
            {"worker_rut": "11111111-1", "date": "2026-05-02", "shift_id": "S_09_19"},
            {"worker_rut": "22222222-2", "date": "2026-05-03", "shift_id": "S_09_19"},
        ]
        payload = _base_payload(assignments_fijas=fijas)
        resp = client.post("/optimize/partial", json=payload)
        asigs = resp.json()["propuestas"][0]["asignaciones"]
        fechas_resultado = {a["date"] for a in asigs}
        # Las fechas fijas (2/3 de mayo) son previas al rango y no deben aparecer
        assert "2026-05-02" not in fechas_resultado
        assert "2026-05-03" not in fechas_resultado

    def test_modo_ilp_tambien_funciona(self, client):
        payload = _base_payload()
        payload["parametros"]["modo"] = "ilp"
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 200
        asigs = resp.json()["propuestas"][0]["asignaciones"]
        for a in asigs:
            assert a["date"] in _RANGE_DATES


# ─── Task 6: restricciones semanales con horas fijas ──────────────────────────

class TestHorasFijasRestriccionSemanal:

    def test_horas_fijas_descontadas_del_presupuesto_semanal(self, client):
        """
        Worker A ya tiene 40h fijas en la semana 20 (11-14 mayo: 4 días × 10h).
        Con límite de 42h, solo puede trabajar 2h más en esa semana.
        El turno S_09_19 dura 10h → Worker A no debe asignarse en esa semana del rango.

        Rango: 15-31 mayo. Mayo 15 es viernes de la semana 20.
        """
        # 4 días de 10h = 40h fijas para Worker A en la semana de mayo 11-17
        fijas_worker_a = [
            {"worker_rut": "11111111-1", "date": f"2026-05-{d:02d}", "shift_id": "S_09_19"}
            for d in [11, 12, 13, 14]  # lun-jue, semana 20 (fuera del rango)
        ]
        payload = _base_payload(assignments_fijas=fijas_worker_a)
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 200

        asigs = resp.json()["propuestas"][0]["asignaciones"]
        # Worker A no debe aparecer el viernes 15 (semana 20) porque ya tiene 40h
        worker_a_en_15 = [
            a for a in asigs
            if a["worker_rut"] == "11111111-1" and a["date"] == "2026-05-15"
        ]
        assert worker_a_en_15 == [], (
            "Worker A no debería tener turno el 15/05 (presupuesto semanal agotado)"
        )

    def test_presupuesto_no_excedido_en_semana_parcial(self, client):
        """
        Verifica que ningún worker supere las horas semanales en la semana
        que se intersecta con el rango, considerando sus horas fijas.
        """
        # Worker B tiene 30h fijas en la semana de mayo 11-17 (3 días × 10h)
        fijas_worker_b = [
            {"worker_rut": "22222222-2", "date": f"2026-05-{d:02d}", "shift_id": "S_09_19"}
            for d in [11, 12, 13]  # 30h fuera del rango
        ]
        payload = _base_payload(assignments_fijas=fijas_worker_b)
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 200

        asigs = resp.json()["propuestas"][0]["asignaciones"]
        # Worker B en la semana 20 (15-17 mayo dentro del rango)
        worker_b_semana_20 = [
            a for a in asigs
            if a["worker_rut"] == "22222222-2" and a["date"] in {"2026-05-15", "2026-05-16", "2026-05-17"}
        ]
        # 30h fijas + máx 1 turno de 10h = 40h ≤ 42h → como máximo 1 turno esa semana
        assert len(worker_b_semana_20) <= 1, (
            f"Worker B tiene {len(worker_b_semana_20)} turnos en semana 20 "
            f"con 30h ya consumidas (límite: 1 turno más)"
        )


# ─── Error paths ──────────────────────────────────────────────────────────────

class TestOptimizePartialErrors:

    def test_422_todos_workers_excluidos(self, client):
        payload = _base_payload(workers_excluidos=["11111111-1", "22222222-2", "33333333-3"])
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 422
        assert "disponibles" in resp.json()["detail"].lower()

    def test_422_rango_infactible_sin_dotacion(self, client):
        """
        Con 1 solo worker disponible y cobertura_minima=2,
        el rango es infactible.
        """
        payload = _base_payload(
            workers=[{"rut": "11111111-1", "nombre": "WORKER A", "constraints": []}],
            workers_excluidos=[],
        )
        payload["parametros"]["cobertura_minima"] = 2
        resp = client.post("/optimize/partial", json=payload)
        assert resp.status_code == 422
