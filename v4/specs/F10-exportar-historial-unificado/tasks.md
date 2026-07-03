# F10 — Tasks

Orden recomendado: cada fase se puede commitear/deployar por separado.
Las 3 pestañas viejas NO se tocan hasta la Fase 7.

## Fase 1: Modelo de datos

- [ ] Agregar `ChangeExportRecord` a `schema.prisma` (auditLogId, workerId, exportedAt, exportedBy; index compuesto).
- [ ] `npx prisma generate` local + verificar tsc.
- [ ] Tras deploy: `db push` en pompeyo (backup de DB antes, como siempre).

## Fase 2: API de consulta

- [ ] Endpoint `GET /api/rrhh/cambios` (nombre sugerido): devuelve las filas (worker+evento de guardado) paginadas server-side, con joins a Worker/BranchTeam/Branch para área/sucursal/código, y la última descarga por fila desde `ChangeExportRecord` (agregación: max exportedAt por auditLogId+workerId).
- [ ] Parámetros de filtro server-side mínimos: rango de fecha de modificación (default últimos 60-90 días), branchId, area, workerId. El resto de los filtros pueden ser client-side sobre la página cargada.
- [ ] Verificar rol admin en el handler (no hay deny-by-default en main).
- [ ] Test del endpoint con Prisma mockeado.

## Fase 3: API de descarga

- [ ] Endpoint `POST /api/rrhh/exportar-seleccion`: recibe lista de claves `(auditLogId, workerId)`, genera Excel formato RRHH (RUT sin DV, DIA1..DIA31, mes completo por trabajador), inserta un `ChangeExportRecord` por fila cubierta con el email de la sesión, y registra `calendar.export` en AuditLog.
- [ ] Botón masivo: reutilizar/envolver `export-masivo` PERO agregando la inserción de `ChangeExportRecord` para todas las filas pendientes cubiertas por ese export.
- [ ] Test: la descarga marca exactamente las filas seleccionadas, no otras.

## Fase 4: UI de la pestaña nueva

- [ ] Componente genérico `ExcelColumnFilter`: desplegable por columna con checklist de valores únicos + buscador interno letra por letra + marcar todos/ninguno. NO existe nada reutilizable hoy — construir desde cero, pensado para reuso.
- [ ] Filtro de rango para columnas de fecha (antes/después/entre + "vacío" para fecha de descarga).
- [ ] Tabla con las 9 columnas en el orden del spec, sort por encabezado (patrón SortTH de SucursalesClient), default: fecha modificación desc.
- [ ] Checkbox por fila + seleccionar-todo-lo-filtrado + contador de seleccionados.
- [ ] Fila expandible con el detalle día-por-día (reutilizar render de ExportarV2Client).
- [ ] Botones: "Descargar selección" (Fase 3) y "Descargar masivo".
- [ ] Registrar la página en AdminShell nav (título por definir con el usuario — sugerencia "Exportar / Historial").
- [ ] Paginación server-side real (no repetir el totalPages=1 de exportar-v2).

## Fase 5: Historial personal del trabajador

- [ ] En `/admin/trabajadores`: vista/modal por trabajador con todos sus eventos de cambio (misma fuente, filtrado por workerId, mismo detalle expandible).

## Fase 6: Botón "Editar horario"

- [ ] Botón en la fila/ficha del trabajador → link al calendario de su equipo del mes actual con `&worker=[workerId]`.
- [ ] En la vista de calendario admin: si viene `worker=`, filtrar/enfocar la tabla a ese trabajador + botón "ver equipo completo".
- [ ] El parámetro debe sobrevivir el redirect a grupo (`/supervisor/calendario?groupId=...`) y aplicarse ahí también.

## Fase 7: Reemplazo de las pestañas viejas (SOLO tras validación del usuario)

- [ ] Usuario valida la pestaña nueva con datos reales en producción.
- [ ] Eliminar `/admin/historial`, `/admin/exportar`, `/admin/exportar-v2` y sus entradas del nav.
- [ ] Evaluar si `export-delta` queda huérfano y limpiar rutas API sin uso.
- [ ] `Calendar.lastExportedAt`: decidir si se sigue actualizando (lo usan las vistas de calendario para badges) o se deprecia.

## Fuera de alcance (NO hacer en esta entrega)

- Pizarra propia del trabajador para armar su horario (pedida por el usuario, pospuesta explícitamente).
