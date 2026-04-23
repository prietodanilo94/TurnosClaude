"""
Genera el archivo .xlsx del turnero a partir de un ExportDataset.
"""
from __future__ import annotations

import re
from calendar import monthrange
from collections import defaultdict
from datetime import date
from io import BytesIO

from openpyxl import Workbook

from app.services.proposal_fetcher import ExportDataset


def rut_without_dv(rut: str) -> str:
    """'17286931-9' → '17286931',  '12345678-K' → '12345678'"""
    return rut.split("-")[0]


def _slugify(text: str) -> str:
    text = text.lower().strip()
    for src, dst in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n"),
                     ("à","a"),("è","e"),("ì","i"),("ò","o"),("ù","u"),
                     ("ä","a"),("ë","e"),("ï","i"),("ö","o"),("ü","u")]:
        text = text.replace(src, dst)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def build_filename(dataset: ExportDataset) -> str:
    slug = _slugify(dataset.branch_nombre)
    return f"turnos_{dataset.codigo_area}_{slug}_{dataset.year}{dataset.month:02d}.xlsx"


def export_proposal_to_xlsx(dataset: ExportDataset) -> bytes:
    days_in_month = monthrange(dataset.year, dataset.month)[1]

    wb = Workbook()
    ws = wb.active
    ws.title = f"{dataset.codigo_area}_{dataset.year}{dataset.month:02d}"

    # Fila de headers
    ws["A1"] = "RUT"
    for d in range(1, days_in_month + 1):
        ws.cell(row=1, column=d + 1, value=f"DIA{d}")

    # Agrupar assignments por worker: {worker_id: {day_number: "HH:MM a HH:MM"}}
    by_worker: dict[str, dict[int, str]] = defaultdict(dict)
    for ra in dataset.resolved_assignments:
        day = date.fromisoformat(ra.date).day
        by_worker[ra.worker_id][day] = f"{ra.hora_inicio} a {ra.hora_fin}"

    # Una fila por trabajador con al menos 1 turno en el mes
    row = 2
    for worker_id, days_map in by_worker.items():
        worker = dataset.workers_by_id.get(worker_id)
        if worker is None:
            continue
        ws.cell(row=row, column=1, value=rut_without_dv(worker.rut))
        for d in range(1, days_in_month + 1):
            if d in days_map:
                ws.cell(row=row, column=d + 1, value=days_map[d])
        row += 1

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
