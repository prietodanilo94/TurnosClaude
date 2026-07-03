# F10 — Tasks

Orden recomendado: cada fase se puede commitear/deployar por separado.
Las 3 pestañas viejas NO se tocan hasta la Fase 7.

**Actualización 2026-07-03**: por instrucción explícita del usuario, las
fases 1-5 se desarrollaron todas en la rama local antes de pushear —no se
verificó cada fase en producción por separado como decía el plan original.
El deploy y la verificación en producción (incluyendo el `db push` de
`ChangeExportRecord`) ocurren una sola vez, al final del batch.

## Fase 1: Modelo de datos — COMPLETO (2026-07-03)

- [x] Agregar `ChangeExportRecord` a `schema.prisma` (auditLogId, workerId, exportedAt, exportedBy; index compuesto).
- [x] `npx prisma generate` local + verificar tsc.
- [ ] Tras deploy: `db push` en pompeyo (backup de DB antes, como siempre). **Pendiente — se hace en el deploy único al final del batch.**

## Fase 2: API de consulta — COMPLETO (2026-07-03, con un cambio de diseño)

Implementado siguiendo la "Guía de implementación" del spec (que precede en
autoridad a la idea original de un endpoint GET paginado): el server
component `page.tsx` de `/admin/exportar-historial` carga la ventana de 90
días y hace los joins directo con Prisma, sin endpoint REST intermedio para
la lectura. La lógica de armado de filas es pura y testeable.

- [x] `src/lib/rrhh/cambiosData.ts`: agrupa `AuditLog` calendar.save por
      (auditLogId, workerId), resuelve área/sucursal/código desde el
      `branchTeam` ACTUAL de cada worker (no desde `AuditLog.branchId`, que
      para guardados de grupo solo refleja el primer equipo — ver spec).
- [x] `page.tsx`: query de la ventana (default 90 días, ampliable con
      `?from=`), resuelve `ChangeExportRecord` más reciente por fila.
- [x] Verificación de rol admin: las rutas de mutación (`/api/rrhh/*`)
      verifican `session.role === "admin"`, como `backfill-missing/route.ts`.
- [x] Tests unitarios de `cambiosData.ts` (agrupación, filas independientes
      por guardado, resolución de última descarga, logs inválidos, orden).

## Fase 3: API de descarga — COMPLETO (2026-07-03)

- [x] Endpoint `POST /api/rrhh/exportar`: recibe `keys: string[]`
      (`auditLogId:workerId`), regenera el Excel RRHH desde el `Calendar`
      VIGENTE de cada trabajador (no desde el metadata del log guardado en su
      momento), inserta `ChangeExportRecord` por fila efectivamente cubierta,
      y registra `calendar.export` en el AuditLog.
- [x] Lógica de armado de la hoja RUT+DIA1..31 extraída a
      `src/lib/excel/rrhhSheet.ts` (con tests) para no duplicarla una 5ta vez.
- [x] "Descargar masivo": ver nota de ambigüedad abajo — implementado como
      "seleccionar todas las filas FILTRADAS actualmente + descargar
      selección", NO como el flujo de `export-masivo`.
- [ ] Test de que la descarga marca exactamente las filas cubiertas — no se
      escribió test automatizado para esto, solo revisión manual del flujo.

**Nota sobre la ambigüedad de "Descargar masivo":** el spec dice
"equivalente al Descargar completo de /admin/exportar → export-masivo", pero
`ChangeExportRecord` solo tiene sentido para filas que existen (trabajadores
con al menos un `calendar.save` registrado) — muchos trabajadores cubiertos
por export-masivo nunca tuvieron un cambio guardado, así que no hay
`(auditLogId, workerId)` que marcar para ellos. Se optó por la
interpretación más coherente con el modelo de datos: masivo = todas las
filas visibles bajo los filtros actuales. **Validar con el usuario si el
comportamiento esperado era otro.**

## Fase 4: UI de la pestaña nueva — COMPLETO (2026-07-03)

- [x] `ExcelColumnFilter.tsx`: desplegable por columna con checklist +
      buscador interno + marcar todos/ninguno.
- [x] `DateColumnFilter.tsx`: rango antes/después + "solo nunca descargados"
      para la columna 8.
- [x] Tabla en `ExportarHistorialClient.tsx` con las 9 columnas del spec,
      sort por encabezado, default fecha modificación desc.
- [x] Checkbox por fila + seleccionar-todo-lo-filtrado + contador.
- [x] Fila expandible con detalle día-por-día (mismo estilo que
      ExportarV2Client).
- [x] Botones "Descargar selección" y "Descargar masivo (filtrado)".
- [x] Registrada en `AdminShell` nav como "Exportar / Historial"
      (`/admin/exportar-historial`). Las 3 pestañas viejas se mantienen.
- [x] Sin paginación server-side — arquitectura del spec es ventana acotada
      (90 días) + todo el filtrado/orden en memoria en el cliente.
- [x] Cascada de filtros y sort extraídos a `src/lib/rrhh/tableFilters.ts`
      (puro, testeado — 8 tests incluyendo la cascada real).

## Fase 5: Historial personal del trabajador — COMPLETO (2026-07-03)

- [x] En `/admin/trabajadores`: botón "Historial" abre modal
      (`WorkerHistoryModal.tsx`) con todos los eventos de ESE trabajador,
      vía `GET /api/rrhh/historial-trabajador?workerId=`, mismo detalle
      expandible que la tabla principal.

## Fase 6: Botón "Editar horario" — DIFERIDO, no implementado (2026-07-03)

Evaluado y **deliberadamente pospuesto** por relación riesgo/beneficio: para
que el parámetro `&worker=` tenga efecto real (enfocar/atenuar filas), hay
que tocar `CalendarView.tsx` + `WeekBlock.tsx` (vista admin, ~1000 líneas,
drag-and-drop activo) y `SupervisorCalendarView`/su WeekBlock equivalente
(vista de grupo), ambos componentes interactivos en producción sin
cobertura de tests automatizados para su UI de arrastre. Modificarlos sin
poder probarlos en navegador durante esta sesión (trabajo en background, sin
verificación visual) es más riesgo del que vale la pena para una mejora de
UX secundaria. Mandar solo el link con el parámetro sin que la página de
destino haga algo con él sería una función a medias y confusa — se prefirió
no entregar nada a entregar algo incompleto.

**Pendiente para una sesión con verificación manual en navegador:**
- [ ] Botón "Editar horario" en fila/ficha del trabajador con `&worker=[workerId]`.
- [ ] Highlight visual (no ocultar filas — riesgo de romper índices de drag/drop) en `WeekBlock.tsx` cuando `focusWorkerId` coincide.
- [ ] Mismo tratamiento en `SupervisorCalendarView` para sucursales agrupadas.
- [ ] El parámetro debe sobrevivir el redirect a grupo (`/supervisor/calendario?groupId=...`).

## Fase 7: Reemplazo de las pestañas viejas (SOLO tras validación del usuario)

- [ ] Usuario valida la pestaña nueva con datos reales en producción.
- [ ] Eliminar `/admin/historial`, `/admin/exportar`, `/admin/exportar-v2` y sus entradas del nav.
- [ ] Evaluar si `export-delta` queda huérfano y limpiar rutas API sin uso.
- [ ] `Calendar.lastExportedAt`: decidir si se sigue actualizando (lo usan las vistas de calendario para badges) o se deprecia.

## Fuera de alcance (NO hacer en esta entrega)

- Pizarra propia del trabajador para armar su horario (pedida por el usuario, pospuesta explícitamente).
