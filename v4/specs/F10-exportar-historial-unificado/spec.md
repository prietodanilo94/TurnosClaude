# F10 — Pestaña unificada de exportación e historial

## Problema

Hoy la información de cambios y descargas está repartida en 3 pantallas que
no conversan entre sí (`/admin/historial`, `/admin/exportar`,
`/admin/exportar-v2` "Cambios RRHH"). El dolor central: **no se entiende
cuándo se descargó algo, ni si algo cambió después de esa descarga**.

Además, la marca de descarga actual (`Calendar.lastExportedAt`) es a nivel de
calendario completo (sucursal+mes) — no dice qué cambio puntual de qué
trabajador quedó cubierto por qué descarga, ni quién la hizo.

## Solución

UNA pestaña nueva (título pendiente — sugerencia: "Exportar / Historial")
que reemplaza a las 3 anteriores. Las 3 viejas se eliminan SOLO después de
que el usuario valide la nueva con datos reales (fase final, no antes).

### La tabla (corazón de la pestaña)

Estilo "hoja de Excel". **Cada fila = un evento de guardado por trabajador**:
si un supervisor guardó un calendario y en ese guardado le cambió 4 días a
Juan, eso es UNA fila de Juan con Eventos=4. Si otra sesión (u otro usuario)
vuelve a guardar cambios de Juan, es OTRA fila. Las filas nunca se pisan
entre sí — cada guardado queda como fila propia.

Fuente de datos: los `AuditLog` con `action: "calendar.save"`, cuyo
`metadata.changes` ya trae el detalle `{workerId, workerName, date, dayLabel,
from, to}` por cambio. La lógica de agrupar por (trabajador, evento de
guardado) YA EXISTE en `/admin/exportar-v2` (`WorkerRow.events[]`) — se
reutiliza, no se reinventa. Clave natural de fila: `(auditLogId, workerId)`.

**Columnas, en este orden exacto:**

| # | Columna | Detalle |
|---|---------|---------|
| 1 | Área | ventas / postventa |
| 2 | Sucursal | nombre |
| 3 | Código | codigo de sucursal |
| 4 | Fecha de última modificación | fecha en que se guardó el calendario (createdAt del AuditLog) |
| 5 | Quién hizo la última modificación | userEmail del AuditLog (quién guardó) |
| 6 | Trabajador modificado | nombre completo |
| 7 | Eventos | cantidad de cambios de ESE trabajador dentro de ESE guardado |
| 8 | Fecha de última descarga | nula si nunca se descargó ese cambio; si no, la más reciente |
| 9 | Quién hizo la última descarga | email; conversa con la columna 8 |

Orden por defecto: columna 4 descendente (más reciente arriba).

**Clic en cualquier parte de la fila** → expande el detalle de cambios de ese
guardado, día por día, estilo Cambios RRHH actual ("de libre pasó a
12:00–19:00", "el martes pasó a libre y el miércoles a 10:00–19:00", con
puntos de color agregado/quitado/cambiado). El render de ese detalle ya
existe en `ExportarV2Client.tsx` — reutilizar.

### Filtros estilo Excel (pieza de UI NUEVA — no existe en el sistema)

Cada columna filtrable tiene un desplegable con:
- **Checklist de valores únicos** de esa columna (marcar todos / algunos /
  ninguno, como Excel)
- **Buscador de texto dentro del desplegable** que filtra la lista de
  valores en vivo, letra por letra

Para las columnas de fecha (4 y 8): filtro por rango (antes de / después de
/ entre). La columna 8 además debe poder filtrar "vacío" (nunca descargado).

Lo que existe hoy en `/admin/sucursales` y `/admin/supervisores` es solo un
buscador global de substring — NO sirve como base para esto. Hay que
construir un componente genérico nuevo (ej. `<ExcelColumnFilter>` +
`<FilterableTable>` o similar), pensado para reutilizarse.

Ordenamiento por columna: clic en el encabezado (asc/desc), como ya hace
`SucursalesClient.tsx` con su `SortTH`.

### Selección y descarga

- **Checkbox por fila** + "seleccionar todo lo filtrado" (los filtros actúan
  como atajo de selección masiva: filtro "ventas" → selecciono todo →
  descargo solo eso).
- **Descargar selección**: exporta SOLO las filas seleccionadas. Formato:
  mismo formato RRHH existente (columnas RUT sin DV + DIA1..DIA31, valores
  "HH:MM a HH:MM"), una fila por trabajador seleccionado con su mes completo
  — consistente con export-masivo/export-delta actuales. (Si Opus encuentra
  ambigüedad aquí, ese es el default decidido; el detalle del cambio ya se
  ve en pantalla al expandir.)
- **Botón "Descargar masivo"**: descarga toda la base actual (equivalente al
  "Descargar completo" de `/admin/exportar` → `export-masivo`).
- Al descargar (selectivo O masivo), TODAS las filas cubiertas quedan
  marcadas con la misma fecha y el mismo autor de descarga.

### Registro de descargas — Opción B (decidida, no cambiar a inferencia)

Tabla NUEVA en el schema (nombre sugerido `ChangeExportRecord`):

```
id          String   @id @default(cuid())
auditLogId  String   // el AuditLog calendar.save que contiene el cambio
workerId    String   // el trabajador especifico dentro de ese guardado
exportedAt  DateTime @default(now())
exportedBy  String   // email de quien ejecuto la descarga
@@index([auditLogId, workerId])
```

- Se inserta un registro por cada fila cubierta en cada descarga.
- Se GUARDA el historial completo de descargas; la tabla muestra solo la más
  reciente por fila.
- `Calendar.lastExportedAt` se mantiene (lo usan las pantallas viejas hasta
  que se eliminen), pero la fuente de verdad de la pestaña nueva es esta
  tabla.
- Requiere `db push` en producción tras el deploy (SQLite, sin migraciones).

### Rendimiento / paginación

La paginación de exportar-v2 está rota (totalPages=1 hardcodeado). La
pestaña nueva necesita paginación real server-side, o límites razonables +
filtros que reduzcan el set. El parseo de `metadata` JSON de los AuditLog es
en memoria — cuidado con cargar TODO el historial sin límite de fecha (default
razonable: últimos 60–90 días, ampliable por filtro).

## Features complementarias (misma entrega)

### Historial personal por trabajador

En la ficha del trabajador (`/admin/trabajadores`): una vista con TODOS los
eventos de cambio de ESE trabajador (todas sus filas, juntas en un solo
lugar). Complementa la tabla principal: allá las filas de un trabajador
quedan mezcladas con las de todos; acá se ven solo las suyas. Misma fuente
de datos, filtrada por workerId. Mismo render de detalle expandible.

### Botón "Editar horario" en trabajadores

En la ficha/fila del trabajador, botón que lleva DIRECTO a la vista de
calendario de su equipo (`/admin/sucursales/[branchId]/calendario/[year]/
[month]?team=[teamId]`) con un parámetro nuevo (ej. `&worker=[workerId]`)
que deja la tabla **filtrada/enfocada en ese trabajador** — el resto del
equipo oculto o atenuado, con botón "ver equipo completo" para quitar el
filtro. Ojo: si la sucursal pertenece a un grupo, esa página redirige a
`/supervisor/calendario?groupId=...` (fix reciente) — el parámetro worker
debe sobrevivir el redirect y aplicarse también en la vista de grupo.

Mes destino: el mes actual.

## Fuera de alcance (explícitamente para después)

- **Pizarra propia del trabajador**: que un trabajador arme su propio
  horario del mes desde un lienzo en limpio, respetando las validaciones
  legales existentes, con buena UI. El usuario lo pidió pero decidió
  dejarlo para una entrega posterior. NO desarrollar ahora.
- Eliminar las 3 pestañas viejas: es la ÚLTIMA fase, solo tras validación
  explícita del usuario con datos reales en producción.

## Contexto técnico útil (para quien desarrolle)

- Repo de referencias: `v4/frontend/src/app/admin/exportar-v2/` (agrupación
  por worker+evento y render del detalle), `v4/frontend/src/app/admin/
  exportar/` (flujo export-masivo/delta y formato RRHH), `v4/frontend/src/
  app/admin/historial/` (filtros por supervisor/sucursal existentes).
- La URL "Ver calendario" está implementada 3 veces con diferencias sutiles
  (historial page, exportar-v2 page, `lib/audit/log.ts` buildCalendarUrl) —
  buena oportunidad de unificar en un helper compartido al construir esto.
- Deny-by-default/ROUTE_POLICY NO está activo en main (se revirtió, ver F8)
  — el middleware actual solo exige sesión para `/api/*`. Las rutas nuevas
  deben verificar `session.role === "admin"` en el handler, como hace
  `backfill-missing/route.ts`.
- Convenciones: código en inglés, UI en español, RUT sin DV en Excel, commits
  `v4/feat(area):`. Después de commit → push a main → deploy automático a
  pompeyo vía GitHub Actions (~4 min) → verificar contenedor.
- Tests: vitest (`npx vitest run --poolOptions.threads.singleThread=true` —
  el modo por defecto crashea por memoria en esta máquina). 3 tests fallan
  de antes (categoría `ventas_mall_7d` inexistente, no relacionado).
- `tsc --noEmit` tiene 1 error preexistente conocido en
  `calendars/route.test.ts` (lastExportedAt) — ignorar ese, cero tolerancia
  al resto.
