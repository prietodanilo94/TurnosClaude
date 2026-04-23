import asyncio
import json
from io import BytesIO

import pytest
from openpyxl import load_workbook

from app.models.schemas import Assignment, Branch, Proposal, ShiftCatalogV2, Worker
from app.services import appwrite_client as ac
from app.services.excel_exporter import export_proposal_to_xlsx
from app.services.proposal_fetcher import (
    ExportDataset,
    ExportError,
    ResolvedAssignment,
    fetch_export_dataset,
)


def _proposal_doc(**overrides):
    base = {
        "$id": "prop_1",
        "branch_id": "branch_1",
        "anio": 2026,
        "mes": 5,
        "modo": "ilp",
        "score": 98.5,
        "factible": True,
        "asignaciones": json.dumps([
            {"slot": 1, "date": "2026-05-04", "shift_id": "ape", "worker_rut": "1-9"}
        ]),
        "dotacion_sugerida": 3,
        "parametros": json.dumps({"modo": "ilp"}),
        "estado": "seleccionada",
        "creada_por": "user_1",
        "metrics": json.dumps({"cobertura_peak_pct": 100}),
    }
    base.update(overrides)
    return base


def test_proposal_parses_json_string_fields():
    proposal = Proposal.model_validate(_proposal_doc())

    assert proposal.asignaciones[0].slot == 1
    assert proposal.asignaciones[0].date == "2026-05-04"
    assert proposal.parametros == {"modo": "ilp"}
    assert proposal.metrics == {"cobertura_peak_pct": 100}


def test_fetch_export_dataset_resolves_shift_catalog_v2_hours(monkeypatch):
    proposal = Proposal.model_validate(_proposal_doc())
    branch = Branch.model_validate({
        "$id": "branch_1",
        "codigo_area": "107",
        "nombre": "Movicenter",
        "tipo_franja": "movicenter",
        "activa": True,
        "creada_desde_excel": True,
    })
    worker = Worker.model_validate({
        "$id": "worker_1",
        "rut": "1-9",
        "nombre_completo": "Andrea Prueba",
        "branch_id": "branch_1",
        "activo": True,
    })
    shift = ShiftCatalogV2.model_validate({
        "$id": "ape",
        "nombre_display": "Apertura corta",
        "rotation_group": "V_M7",
        "nombre_turno": "apertura",
        "horario_por_dia": json.dumps({
            "lunes": {"inicio": "10:00", "fin": "19:00"},
            "domingo": {"inicio": "11:00", "fin": "20:00"},
        }),
        "descuenta_colacion": True,
        "dias_aplicables": ["lunes", "domingo"],
    })
    assignment = Assignment.model_validate({
        "$id": "asg_1",
        "proposal_id": "prop_1",
        "slot_numero": 1,
        "worker_id": "worker_1",
    })

    async def fake_get_proposal(_proposal_id: str):
        return proposal

    async def fake_list_assignments(_proposal_id: str):
        return [assignment]

    async def fake_get_branch(_branch_id: str):
        return branch

    async def fake_get_shift_catalog_v2():
        return [shift]

    async def fake_list_workers(_worker_ids: list[str]):
        return [worker]

    monkeypatch.setattr(ac, "get_proposal", fake_get_proposal)
    monkeypatch.setattr(ac, "list_assignments_by_proposal", fake_list_assignments)
    monkeypatch.setattr(ac, "get_branch", fake_get_branch)
    monkeypatch.setattr(ac, "get_shift_catalog_v2", fake_get_shift_catalog_v2)
    monkeypatch.setattr(ac, "list_workers_by_ids", fake_list_workers)

    dataset = asyncio.run(fetch_export_dataset("prop_1"))

    assert dataset.codigo_area == "107"
    assert dataset.branch_nombre == "Movicenter"
    assert dataset.resolved_assignments == [
        ResolvedAssignment(
            date="2026-05-04",
            shift_id="ape",
            worker_id="worker_1",
            hora_inicio="10:00",
            hora_fin="19:00",
        )
    ]


def test_fetch_export_dataset_rejects_unassigned_slots(monkeypatch):
    proposal = Proposal.model_validate(_proposal_doc())
    branch = Branch.model_validate({
        "$id": "branch_1",
        "codigo_area": "107",
        "nombre": "Movicenter",
        "tipo_franja": "movicenter",
        "activa": True,
        "creada_desde_excel": True,
    })
    shift = ShiftCatalogV2.model_validate({
        "$id": "ape",
        "nombre_display": "Apertura corta",
        "rotation_group": "V_M7",
        "nombre_turno": "apertura",
        "horario_por_dia": {"lunes": {"inicio": "10:00", "fin": "19:00"}},
        "descuenta_colacion": True,
        "dias_aplicables": ["lunes"],
    })
    assignment = Assignment.model_validate({
        "$id": "asg_1",
        "proposal_id": "prop_1",
        "slot_numero": 1,
        "worker_id": None,
    })

    async def fake_get_proposal(_proposal_id: str):
        return proposal

    async def fake_list_assignments(_proposal_id: str):
        return [assignment]

    async def fake_get_branch(_branch_id: str):
        return branch

    async def fake_get_shift_catalog_v2():
        return [shift]

    async def fake_list_workers(_worker_ids: list[str]):
        return []

    monkeypatch.setattr(ac, "get_proposal", fake_get_proposal)
    monkeypatch.setattr(ac, "list_assignments_by_proposal", fake_list_assignments)
    monkeypatch.setattr(ac, "get_branch", fake_get_branch)
    monkeypatch.setattr(ac, "get_shift_catalog_v2", fake_get_shift_catalog_v2)
    monkeypatch.setattr(ac, "list_workers_by_ids", fake_list_workers)

    with pytest.raises(ExportError, match="slot\\(s\\) sin asignar"):
        asyncio.run(fetch_export_dataset("prop_1"))


def test_export_proposal_to_xlsx_uses_resolved_hours():
    proposal = Proposal.model_validate(_proposal_doc())
    worker = Worker.model_validate({
        "$id": "worker_1",
        "rut": "17286931-9",
        "nombre_completo": "Andrea Prueba",
        "branch_id": "branch_1",
        "activo": True,
    })
    dataset = ExportDataset(
        proposal=proposal,
        resolved_assignments=[
            ResolvedAssignment(
                date="2026-05-01",
                shift_id="ape",
                worker_id="worker_1",
                hora_inicio="11:00",
                hora_fin="20:00",
            )
        ],
        workers_by_id={"worker_1": worker},
        codigo_area="107",
        branch_nombre="Movicenter",
        year=2026,
        month=5,
    )

    content = export_proposal_to_xlsx(dataset)
    wb = load_workbook(BytesIO(content))
    ws = wb.active

    assert ws["A2"].value == "17286931"
    assert ws["B2"].value == "11:00 a 20:00"
