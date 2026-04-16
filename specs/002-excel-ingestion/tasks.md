# Tasks — Spec 002

- [ ] **Task 1**: `lib/rut-utils.ts` con `validarRut` y `normalizarRut`. Tests unitarios con RUTs válidos e inválidos. Cubrir DV `K`, RUTs con puntos, con guion, sin nada.

- [ ] **Task 2**: `lib/excel-parser.ts`. Función `parseDotacionExcel(file: File): ParsedRow[]`. Detecta encabezados por nombre (case-insensitive, trim). Devuelve filas normalizadas y un array de errores de parseo.

- [ ] **Task 3**: Ruta `/admin/dotacion` con `ExcelDropZone` funcional. Al soltar archivo, muestra tabla con filas parseadas (aún sin hablar con Appwrite).

- [ ] **Task 4**: Integrar fetch de `branches` y `workers` existentes. Computar el diff (nuevas branches, workers nuevos/actualizados/a desactivar).

- [ ] **Task 5**: `NewBranchesPanel` para asignar `tipo_franja` a sucursales nuevas. Dropdown con los 5 tipos. El botón de confirmación se bloquea hasta asignar todas.

- [ ] **Task 6**: `lib/sync-dotacion.ts` implementa la función de sync. Transacción "lógica" (no hay transacciones reales en Appwrite): orden = branches nuevas → workers upserts → workers soft-delete → audit_log. Si algo falla en medio, reporta al admin con qué alcanzó a escribir.

- [ ] **Task 7**: `SyncConfirmDialog` con preview final y botón "Sincronizar". Muestra progress y reporte al terminar.

- [ ] **Task 8**: Tests de integración usando un mock de Appwrite (o una instancia dev separada). Casos: primer upload, upload con branches nuevas, re-upload idéntico (no-op), re-upload con trabajador removido (soft-delete).

- [ ] **Task 9**: Documentar en `docs/` el proceso end-to-end con screenshots.

## DoD

- El admin puede subir el archivo de ejemplo (`Dotación_ejemplo_claude.xlsx`) y ver los 7 trabajadores.
- Tras confirmar, Appwrite tiene las sucursales y workers.
- Re-subir el mismo archivo no crea duplicados.
- Subir un archivo con un trabajador menos deja a ese trabajador con `activo=false`.
