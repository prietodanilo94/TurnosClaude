"""
Consolida todos los datos necesarios para exportar una propuesta a Excel.
"""
from __future__ import annotations

import asyncio
from calendar import monthrange
from dataclasses import dataclass
from datetime import date

from app.models.schemas import Assignment, Proposal, ShiftCatalogV2, SlotOverride, Worker
from app.services import appwrite_client as ac


class ExportError(ValueError):
    """Error de negocio que impide la exportacion."""


@dataclass
class ResolvedAssignment:
    """Un slot con fecha, turno y trabajador ya resueltos."""

    slot_numero: int
    date: str
    shift_id: str
    shift_label: str
    worker_id: str
    hora_inicio: str
    hora_fin: str
    horas_laborales: float
    override_applied: bool = False
    override_type: str | None = None
    override_note: str | None = None


@dataclass
class ExportDataset:
    proposal: Proposal
    resolved_assignments: list[ResolvedAssignment]
    workers_by_id: dict[str, Worker]
    worker_slot_by_id: dict[str, int]
    codigo_area: str
    branch_nombre: str
    branch_clasificacion: str | None
    area_negocio_label: str
    year: int
    month: int
    holidays: set[str]
    closed_dates: set[str]
    slot_overrides: list[SlotOverride]


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


def _labor_hours(shift: ShiftCatalogV2, iso_date: str) -> float:
    hora_inicio, hora_fin = _resolve_shift_hours(shift, iso_date)
    inicio_h, inicio_m = map(int, hora_inicio.split(":"))
    fin_h, fin_m = map(int, hora_fin.split(":"))
    duration_minutes = (fin_h * 60 + fin_m) - (inicio_h * 60 + inicio_m)
    if shift.descuenta_colacion:
        duration_minutes -= 60
    return max(duration_minutes, 0) / 60


def _normalize_date(value: str) -> str:
    return value[:10]


def _area_negocio_label(workers: list[Worker]) -> str:
    values = sorted({worker.area_negocio for worker in workers if worker.area_negocio})
    if len(values) == 1:
        return values[0].capitalize()
    if len(values) > 1:
        return "Mixto"
    return "No definido"


def _closed_dates_for_month(
    year: int,
    month: int,
    relevant_shifts: list[ShiftCatalogV2],
) -> set[str]:
    closed_dates: set[str] = set()
    for day_number in range(1, monthrange(year, month)[1] + 1):
        iso_date = date(year, month, day_number).isoformat()
        weekday = _weekday_key(iso_date)
        is_open = any(
            weekday in shift.horario_por_dia
            and (not shift.dias_aplicables or weekday in shift.dias_aplicables)
            for shift in relevant_shifts
        )
        if not is_open:
            closed_dates.add(iso_date)
    return closed_dates


async def fetch_export_dataset(proposal_id: str) -> ExportDataset:
    """
    Carga desde Appwrite todos los datos de la propuesta y los consolida.

    Raises:
        KeyError: si la propuesta no existe.
        ExportError: si la propuesta no esta seleccionada o tiene slots sin asignar.
    """
    proposal = await ac.get_proposal(proposal_id)

    if proposal.estado not in ("seleccionada", "exportada"):
        raise ExportError(
            f"Solo se pueden exportar propuestas seleccionadas "
            f"(estado actual: {proposal.estado!r})"
        )

    assignments, branch, shifts, branch_workers, holidays, slot_overrides = await asyncio.gather(
        ac.list_assignments_by_proposal(proposal_id),
        ac.get_branch(proposal.branch_id),
        ac.get_shift_catalog_v2(),
        ac.list_workers_by_branch(proposal.branch_id),
        ac.list_holidays_by_year(proposal.anio),
        ac.list_slot_overrides_by_proposal(proposal_id),
    )

    slot_index = {slot.slot: slot for slot in proposal.asignaciones}
    shifts_by_id = {shift.id: shift for shift in shifts}
    overrides_by_slot_date = {
        (override.slot_numero, _normalize_date(override.fecha)): override
        for override in slot_overrides
        if override.slot_numero is not None
    }

    relevant_rotation_groups = {
        worker.rotation_group for worker in branch_workers if worker.rotation_group
    }
    relevant_shifts = [
        shift for shift in shifts if shift.rotation_group in relevant_rotation_groups
    ] or [shift for shift in shifts if shift.id in {slot.shift_id for slot in proposal.asignaciones}]

    resolved: list[ResolvedAssignment] = []
    unassigned_slots: list[int] = []

    for assignment in assignments:
        if assignment.worker_id is None:
            unassigned_slots.append(assignment.slot_numero)
            continue

        slot = slot_index.get(assignment.slot_numero)
        if slot is None:
            continue

        shift = shifts_by_id.get(slot.shift_id)
        if shift is None:
            raise ExportError(
                f"La propuesta referencia el turno {slot.shift_id!r}, "
                "pero no existe en shift_catalog_v2"
            )

        hora_inicio, hora_fin = _resolve_shift_hours(shift, slot.date)
        override = overrides_by_slot_date.get((assignment.slot_numero, slot.date))
        resolved.append(
            ResolvedAssignment(
                slot_numero=assignment.slot_numero,
                date=slot.date,
                shift_id=slot.shift_id,
                shift_label=shift.nombre_display,
                worker_id=assignment.worker_id,
                hora_inicio=hora_inicio,
                hora_fin=hora_fin,
                horas_laborales=_labor_hours(shift, slot.date),
                override_applied=override is not None,
                override_type=override.tipo.value if override else None,
                override_note=override.notas if override else None,
            )
        )

    if unassigned_slots:
        raise ExportError(
            f"La propuesta tiene {len(unassigned_slots)} slot(s) sin asignar: "
            f"{sorted(unassigned_slots)}"
        )

    worker_slot_by_id = {
        assignment.worker_id: assignment.slot_numero
        for assignment in assignments
        if assignment.worker_id is not None
    }
    worker_ids = list(worker_slot_by_id.keys())
    workers = await ac.list_workers_by_ids(worker_ids)

    return ExportDataset(
        proposal=proposal,
        resolved_assignments=resolved,
        workers_by_id={worker.id: worker for worker in workers},
        worker_slot_by_id=worker_slot_by_id,
        codigo_area=branch.codigo_area,
        branch_nombre=branch.nombre,
        branch_clasificacion=branch.clasificacion,
        area_negocio_label=_area_negocio_label(branch_workers),
        year=proposal.anio,
        month=proposal.mes,
        holidays={
            _normalize_date(holiday.fecha)
            for holiday in holidays
            if _normalize_date(holiday.fecha).startswith(f"{proposal.anio:04d}-{proposal.mes:02d}-")
        },
        closed_dates=_closed_dates_for_month(proposal.anio, proposal.mes, relevant_shifts),
        slot_overrides=slot_overrides,
    )
