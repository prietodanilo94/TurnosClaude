"""
Consolida todos los datos necesarios para exportar una propuesta a Excel.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.models.schemas import Assignment, Proposal, ShiftCatalogV2, Worker
from app.services import appwrite_client as ac


class ExportError(ValueError):
    """Error de negocio que impide la exportación (→ 422)."""


@dataclass
class ResolvedAssignment:
    """Un slot con fecha, turno y trabajador ya resueltos."""
    date: str        # "YYYY-MM-DD"
    shift_id: str
    worker_id: str
    hora_inicio: str
    hora_fin: str


@dataclass
class ExportDataset:
    proposal: Proposal
    resolved_assignments: list[ResolvedAssignment]
    workers_by_id: dict[str, Worker]
    codigo_area: str
    branch_nombre: str
    year: int
    month: int


_WEEKDAY_KEYS = (
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
)


def _weekday_key(iso_date: str) -> str:
    return _WEEKDAY_KEYS[date.fromisoformat(iso_date).weekday()]


def _resolve_shift_hours(shift: ShiftCatalogV2, iso_date: str) -> tuple[str, str]:
    weekday = _weekday_key(iso_date)
    horario = shift.horario_por_dia.get(weekday)
    if horario is None:
        raise ExportError(
            f"El turno {shift.id!r} no tiene horario definido para {weekday} ({iso_date})"
        )
    return horario.inicio, horario.fin


async def fetch_export_dataset(proposal_id: str) -> ExportDataset:
    """
    Carga desde Appwrite todos los datos de la propuesta y los consolida.

    Raises:
        KeyError: si la propuesta no existe.
        ExportError: si la propuesta no está seleccionada o tiene slots sin asignar.
    """
    proposal = await ac.get_proposal(proposal_id)

    if proposal.estado not in ("seleccionada", "exportada"):
        raise ExportError(
            f"Solo se pueden exportar propuestas seleccionadas "
            f"(estado actual: {proposal.estado!r})"
        )

    # Cargar assignments, branch y shifts en paralelo
    import asyncio
    assignments, branch, shifts = await asyncio.gather(
        ac.list_assignments_by_proposal(proposal_id),
        ac.get_branch(proposal.branch_id),
        ac.get_shift_catalog_v2(),
    )

    # Índice slot_numero → AssignmentSlot (fecha + shift_id)
    slot_index = {slot.slot: slot for slot in proposal.asignaciones}
    shifts_by_id = {s.id: s for s in shifts}

    # Resolver assignments: cruzar slot_numero con AssignmentSlot
    resolved: list[ResolvedAssignment] = []
    unassigned_slots: list[int] = []

    for a in assignments:
        if a.worker_id is None:
            unassigned_slots.append(a.slot_numero)
            continue
        slot = slot_index.get(a.slot_numero)
        if slot is None:
            continue  # slot huérfano, se ignora
        shift = shifts_by_id.get(slot.shift_id)
        if shift is None:
            raise ExportError(
                f"La propuesta referencia el turno {slot.shift_id!r}, pero no existe en shift_catalog_v2"
            )
        hora_inicio, hora_fin = _resolve_shift_hours(shift, slot.date)
        resolved.append(ResolvedAssignment(
            date=slot.date,
            shift_id=slot.shift_id,
            worker_id=a.worker_id,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
        ))

    if unassigned_slots:
        raise ExportError(
            f"La propuesta tiene {len(unassigned_slots)} slot(s) sin asignar: "
            f"{sorted(unassigned_slots)}"
        )

    # Cargar workers únicos
    worker_ids = list({r.worker_id for r in resolved})
    workers = await ac.list_workers_by_ids(worker_ids)

    return ExportDataset(
        proposal=proposal,
        resolved_assignments=resolved,
        workers_by_id={w.id: w for w in workers},
        codigo_area=branch.codigo_area,
        branch_nombre=branch.nombre,
        year=proposal.anio,
        month=proposal.mes,
    )
