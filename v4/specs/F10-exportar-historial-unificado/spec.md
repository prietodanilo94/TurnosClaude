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

**Corrección 2026-07-03, tras probar con datos reales:** en la tabla
PRINCIPAL, cada trabajador aparece **una sola vez** — el guardado más
reciente sobreescribe al anterior (columna Eventos = cambios de ESE último
guardado, no acumulado). El detalle histórico completo de TODOS los
guardados de un trabajador se ve en `/admin/trabajadores` → Historial (F10
fase 5), que es exactamente para eso. La versión original de este párrafo
decía "cada guardado es una fila propia, nunca se pisan" — eso quedó
descartado porque en producción generaba filas duplicadas/redundantes
(agravado por un bug real de guardados repetidos, ver `tasks.md`). La clave
`(auditLogId, workerId)` se sigue usando para identificar de qué guardado
viene la fila sobreviviente, pero ya no hay una fila por cada evento.

Estilo "hoja de Excel". Fuente de datos: los `AuditLog` con
`action: "calendar.save"`, cuyo `metadata.changes` ya trae el detalle
`{workerId, workerName, date, dayLabel, from, to}` por cambio.

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

## Guía de implementación (de programador a programador)

Decisiones de diseño a nivel de código. No son sugerencias abiertas — son el
camino elegido; desviarse solo con razón concreta.

### Arquitectura de datos: ventana en server, todo lo demás en client

Los filtros estilo Excel (checklist de valores únicos) son incompatibles con
paginación server-side real: el checklist necesita los valores del set
completo, no de la página visible. La solución NO es paginar — es acotar:

1. El **server component** (`page.tsx`) carga UNA ventana de datos (default
   últimos 60–90 días de `calendar.save`, ampliable por query param de
   fecha), hace todos los joins, parsea los `metadata` JSON, y entrega al
   client un array de DTOs planos. Volumen esperado: cientos de filas, no
   miles — SQLite y React lo manejan sin paginación.
2. El **client component** hace TODO lo demás en memoria: filtros por
   columna, sort, selección, expansión. Sin fetch adicionales al filtrar.
3. Si el volumen real algún día lo exige, paginar es una optimización
   posterior — no construirla especulativamente ahora (la paginación rota
   de exportar-v2 nació de ese intento).

### DTO de fila (contrato server → client)

El client NUNCA parsea `metadata` JSON — eso pasa solo en el server:

```ts
interface CambioRow {
  key: string;            // `${auditLogId}:${workerId}` — clave única de fila
  area: "ventas" | "postventa";
  sucursal: string;
  codigo: string;
  fechaMod: string;       // ISO — createdAt del AuditLog
  modificadoPor: string;  // userEmail del AuditLog
  workerId: string;
  trabajador: string;
  eventos: number;        // changes.filter(c => c.workerId === workerId).length
  cambios: ChangeItem[];  // el detalle para la fila expandida
  fechaDescarga: string | null;   // max(exportedAt) de ChangeExportRecord
  descargadoPor: string | null;   // exportedBy de ese registro max
}
```

### Agregación de "última descarga"

Prisma+SQLite no hace `groupBy` con max compuesto cómodamente. Camino simple:
traer los `ChangeExportRecord` cuyos `auditLogId` estén en la ventana cargada
(una query con `where: { auditLogId: { in: [...] } }`, ordenada por
`exportedAt desc`) y reducir en memoria con un `Map` quedándose con el
primero por `${auditLogId}:${workerId}`. Cientos de filas — trivial.

### ExcelColumnFilter: cascada como Excel real

Estado de filtros en el client padre: `Record<columnId, Set<string> | null>`
(null = "todos", sin filtro). Detalle que define la sensación Excel: los
valores del checklist de una columna se computan desde las filas que
sobreviven a los filtros de las DEMÁS columnas (no del set original ni del
set totalmente filtrado) — así al filtrar "ventas", el checklist de sucursal
solo ofrece sucursales de ventas. `useMemo` por columna.

Lógica pura (aplicar filtros, computar valores en cascada) en
`src/lib/` como funciones puras testeables — patrón del repo (como
`teamSplit.ts`, `combineGroupTeams.ts`): páginas delgadas, lógica en lib con
test unitario al lado.

### Selección y descarga selectiva

- Selección: `Set<string>` de row keys. "Seleccionar todo lo filtrado" =
  keys de las filas visibles tras filtros.
- La descarga selectiva es un `POST` (body: array de keys) que devuelve el
  binario — en el client usar `fetch` + `response.blob()` + link temporal
  para descargar; `window.open` no sirve para POST.
- El server valida las keys, regenera el Excel desde los `Calendar` ACTUALES
  (no desde el metadata del log — el Excel siempre refleja el estado vigente
  del mes), hace `createMany` de `ChangeExportRecord` y registra
  `calendar.export` en el AuditLog. La generación del sheet RRHH ya existe:
  `buildRrhhSheet` en `export-group/route.ts` — extraerla a `src/lib/excel/`
  y reutilizar en vez de duplicar (sería la cuarta copia).

### Orden de trabajo dentro de cada fase

El repo se desarrolla probando contra producción real (pompeyo) con backup
de DB antes de cada escritura de datos. Por fase: implementar → `tsc` +
vitest local → commit (`v4/feat(rrhh): ...`) → push → esperar deploy (~4
min) → verificar en producción con datos reales antes de pasar a la
siguiente fase. No acumular fases sin verificar.
