# Plan — Spec 007

## Archivos

```
backend/app/
├── api/routes.py                     ← + endpoint /export
├── services/
│   ├── appwrite_client.py            ← Cliente servidor con API Key
│   ├── proposal_fetcher.py           ← Arma el dataset consolidado
│   └── excel_exporter.py             ← Genera xlsx con openpyxl
└── models/export.py                  ← Schemas

frontend/src/
├── lib/export/
│   └── trigger-download.ts           ← Fetch binario + saveAs
```

## Endpoint

`POST /export`

Request:
```json
{ "proposal_id": "..." }
```

Response:
- 200: binario xlsx con `Content-Disposition: attachment; filename="..."`.
- 403: jefe sin acceso a esa branch.
- 404: propuesta no encontrada.
- 422: propuesta tiene slots sin asignar.

## Algoritmo del exporter

```python
def export_proposal_to_xlsx(dataset: ExportDataset) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = f"{dataset.codigo_area}_{dataset.year}{dataset.month:02d}"

    days_in_month = monthrange(dataset.year, dataset.month)[1]

    # Header
    ws["A1"] = "RUT"
    for d in range(1, days_in_month + 1):
        ws.cell(row=1, column=d + 1, value=f"DIA{d}")

    # Agrupar assignments por worker
    by_worker: dict[str, dict[int, str]] = defaultdict(dict)
    for a in dataset.assignments:
        if a.worker_id is None:
            raise ExportError("Hay slots sin asignar")
        day = parse_iso(a.date).day
        shift = dataset.shifts_by_id[a.shift_id]
        by_worker[a.worker_id][day] = f"{shift.hora_inicio} a {shift.hora_fin}"

    # Fila por trabajador (solo los que tienen al menos 1 turno)
    row = 2
    for worker_id, days_map in by_worker.items():
        worker = dataset.workers_by_id[worker_id]
        ws.cell(row=row, column=1, value=rut_without_dv(worker.rut))
        for d in range(1, days_in_month + 1):
            if d in days_map:
                ws.cell(row=row, column=d + 1, value=days_map[d])
        row += 1

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
```

## Helper

```python
def rut_without_dv(rut: str) -> str:
    # "17286931-9" → "17286931"
    return rut.split("-")[0]
```

## Decisiones

- El backend es la fuente autoritativa del formato.
- No generamos filas para trabajadores sin turno en el mes (más limpio para los sistemas downstream).
- La hoja se nombra con código y YYYYMM para fácil ordenamiento alfabético.
