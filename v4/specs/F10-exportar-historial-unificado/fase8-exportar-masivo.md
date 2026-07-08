# F10 Fase 8 — Página "Exportar Masivo" (pedida 2026-07-07 tras incidente de carga)

Contexto: una carga masiva al sistema central mezcló filas de junio y julio
(descarga "seleccionar todo" en Exportar Historial abarca la ventana de 90
días). Ya corregido: la descarga de Exportar Historial ahora genera **una
hoja por mes**, y en el nav se ocultaron Historial y Cambios RRHH y se
renombró Exportar → "Exportar Masivo".

## Lo que falta construir: reemplazar la página /admin/exportar

Nueva vista "Exportar Masivo" = **toda la empresa, un mes a la vez**:

- Filtros arriba: **mes y año** (obligatorios, default mes actual) — nunca
  se mezclan meses.
- Tabla: Área, Sucursal, Código, Trabajador, RUT (sin DV) y luego columnas
  DIA1..DIA31 con el turno como en el archivo de descarga ("10:00 a 19:00",
  vacío = libre).
- Filtros tipo Exportar Historial (reusar `ExcelColumnFilter`/`tableFilters`
  o al menos filtro por sucursal/área).
- Botón descargar: **todo el mes** o **lo filtrado** — mismo formato RRHH,
  UNA hoja (un solo mes por construcción). Decidir si marca
  lastExportedAt/ChangeExportRecord (sugerencia: NO marcar nada — esta
  vista es "foto"; el tracking de descargas queda en Exportar Historial).
- Fuente de datos: igual que export-masivo (calendars del mes + assignments
  + workers), server component con ventana de UN mes; volumen ~460 filas.
- Los flujos viejos de /admin/exportar (masivo/delta) pueden quedar como
  botones secundarios o retirarse — decidir con el usuario al implementar.

Usuarios Isa y César serán instruidos, pero la UI debe hacer imposible el
error: mes siempre explícito y visible.
