"""
Cliente server-side de Appwrite usando API Key (no JWT).
Usado por el backend para leer propuestas, assignments, workers y turnos.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

import httpx

from app.core.config import settings
from app.models.schemas import (
    Assignment,
    Branch,
    BranchManager,
    Proposal,
    ShiftCatalog,
    Worker,
)

_DB = settings.appwrite_database_id


def _headers() -> dict[str, str]:
    return {
        "X-Appwrite-Project": settings.appwrite_project_id,
        "X-Appwrite-Key": settings.appwrite_api_key,
        "Content-Type": "application/json",
    }


def _q(method: str, attribute: str, values: list[Any]) -> str:
    return json.dumps({"method": method, "attribute": attribute, "values": values})


def _qlimit(n: int) -> str:
    return json.dumps({"method": "limit", "values": [n]})


def _collection_url(collection: str) -> str:
    return f"{settings.appwrite_endpoint}/databases/{_DB}/collections/{collection}/documents"


async def get_branch(branch_id: str) -> Branch:
    url = f"{_collection_url('branches')}/{branch_id}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=_headers())
    if r.status_code == 404:
        raise KeyError(f"Sucursal {branch_id!r} no encontrada")
    r.raise_for_status()
    return Branch.model_validate(r.json())


async def get_proposal(proposal_id: str) -> Proposal:
    url = f"{_collection_url('proposals')}/{proposal_id}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=_headers())
    if r.status_code == 404:
        raise KeyError(f"Propuesta {proposal_id!r} no encontrada")
    r.raise_for_status()
    return Proposal.model_validate(r.json())


async def list_assignments_by_proposal(proposal_id: str) -> list[Assignment]:
    params = {
        "queries[]": [
            _q("equal", "proposal_id", [proposal_id]),
            _qlimit(500),
        ]
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(_collection_url("assignments"), headers=_headers(), params=params)
    r.raise_for_status()
    return [Assignment.model_validate(doc) for doc in r.json()["documents"]]


async def list_workers_by_ids(worker_ids: list[str]) -> list[Worker]:
    if not worker_ids:
        return []
    # Appwrite soporta igual("$id", [...]) para buscar por IDs
    params = {
        "queries[]": [
            _q("equal", "$id", worker_ids),
            _qlimit(200),
        ]
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(_collection_url("workers"), headers=_headers(), params=params)
    r.raise_for_status()
    return [Worker.model_validate(doc) for doc in r.json()["documents"]]


async def get_shift_catalog() -> list[ShiftCatalog]:
    params = {"queries[]": [_qlimit(50)]}
    async with httpx.AsyncClient() as client:
        r = await client.get(_collection_url("shift_catalog"), headers=_headers(), params=params)
    r.raise_for_status()
    return [ShiftCatalog.model_validate(doc) for doc in r.json()["documents"]]


async def list_branch_managers_by_user(user_id: str) -> list[BranchManager]:
    """Retorna los branch_managers activos (asignado_hasta == null) del usuario."""
    params = {
        "queries[]": [
            _q("equal", "user_id", [user_id]),
            _q("isNull", "asignado_hasta", []),
            _qlimit(100),
        ]
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(_collection_url("branch_managers"), headers=_headers(), params=params)
    r.raise_for_status()
    return [BranchManager.model_validate(doc) for doc in r.json()["documents"]]


async def create_audit_log(
    user_id: str,
    accion: str,
    entidad: str | None = None,
    entidad_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    body = {
        "user_id": user_id,
        "accion": accion,
        "entidad": entidad,
        "entidad_id": entidad_id,
        "metadata": metadata,
    }
    url = _collection_url("audit_log")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            url,
            headers=_headers(),
            json={"documentId": str(uuid.uuid4()).replace("-", "")[:20], "data": body},
        )
    # Fallo silencioso: el audit log no debe bloquear la exportación
    if r.status_code not in (200, 201):
        import logging
        logging.getLogger(__name__).warning("audit_log write failed: %s %s", r.status_code, r.text)
