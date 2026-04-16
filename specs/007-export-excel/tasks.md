# Tasks — Spec 007

- [ ] **Task 1**: `backend/app/services/appwrite_client.py`: cliente servidor con API Key. Métodos `get_proposal`, `list_assignments_by_proposal`, `list_workers_by_ids`, `get_shift_catalog`.

- [ ] **Task 2**: `services/proposal_fetcher.py`: arma `ExportDataset` consolidando propuesta + assignments + workers + shifts_catalog. Retorna un solo objeto listo para el exporter.

- [ ] **Task 3**: `services/excel_exporter.py`: implementa `export_proposal_to_xlsx(dataset) -> bytes`. Tests con fixtures que cubran: mes de 30 días, mes de 31, febrero 28, febrero 29, trabajador sin ningún turno (se omite), RUT con DV K.

- [ ] **Task 4**: Endpoint `POST /export` con validación de permisos (admin o jefe con branch autorizada). Retorna binario con headers correctos.

- [ ] **Task 5**: Manejo de edge cases:
  - Propuesta con slots sin asignar → 422 con mensaje claro.
  - Propuesta con violaciones → warning en header `X-Export-Warnings` pero permite descargar.
  - Propuesta no seleccionada → 422.

- [ ] **Task 6**: `frontend/lib/export/trigger-download.ts`: fetch con JWT, recibe blob, usa `URL.createObjectURL` + `<a download>` para trigger. Toma el filename del header `Content-Disposition`.

- [ ] **Task 7**: Botón "Exportar Excel" conectado en el calendario (Spec 004). Estado de loading y manejo de errores (toast).

- [ ] **Task 8**: Log en `audit_log` desde el backend (accion=`export`, metadata={proposal_id, filename, filas_exportadas}).

- [ ] **Task 9**: Test E2E: generar propuesta, asignar trabajadores, exportar, abrir archivo descargado con openpyxl en el test y validar contenido celda por celda.

- [ ] **Task 10**: Documentar el formato final en `docs/export-format.md` con ejemplo real.

## DoD

- [ ] Se puede descargar el xlsx desde la UI.
- [ ] El archivo abre correctamente en Excel y Google Sheets.
- [ ] Formato cumple spec al 100%.
- [ ] Permisos validados en backend.
- [ ] Test E2E pasa.
