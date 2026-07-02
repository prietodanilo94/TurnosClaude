# F9 — Tasks

## Fase 1: Diseño y validación

- [x] Confirmar con el usuario: Opción A (ancla persistente, schema) elegida.
- [x] Decidir qué hacer con los calendarios ya generados en junio/julio 2026: se corrió backfill retroactivo (ver Fase 4), y se acepta deuda histórica no resuelta para los casos sin causa raíz clara — junio es mes cerrado, sin impacto operativo.

## Fase 2: Implementación

- [x] Agregar `rotationAnchor Int?` a `Worker` en `schema.prisma`.
- [x] `lib/calendar/rotationAnchor.ts`: `resolveRotationAnchors` (puro) + `ensureRotationAnchors` (persiste anclas nuevas de forma perezosa, sin migración masiva obligatoria).
- [x] Cambiar `generateCalendar` para recibir `slotAnchors: number[]` en vez de `workerCount: number`.
- [x] Actualizar `buildSoloBlock` y `buildGroupBlock` (`supervisor/calendario/page.tsx`).
- [x] Actualizar `onRecalculateCalendar` en `SupervisorCalendarView.tsx` — se eliminó el mecanismo `prevAssignments` (mismo bug, copiaba por slot).
- [x] Actualizar `backfill-missing/route.ts`.
- [x] Actualizar el resto de call sites: `admin/sucursales/.../page.tsx`, `export/route.ts`, `export-group/route.ts` (2 lugares), `vendedor/[year]/[month]/page.tsx`, `calendarExport.ts`.
- [x] Eliminar `GenerateButton.tsx` (código muerto, habría quedado inconsistente con la firma nueva).
- [x] Trabajador nuevo sin ancla: se le fija según su posición actual la primera vez que se usa (comportamiento por defecto, mismo criterio que antes pero congelado).

## Fase 3: Tests

- [x] Test: el ancla (no la posición en el array) determina la semana de rotación — `generator.test.ts`.
- [x] Suite completa corrida: 24/27 tests pasan (3 fallos preexistentes sin relación, categoría `ventas_mall_7d` faltante en catálogo).
- [ ] Test de regresión dedicado combinando el fix de offset (grupo) + ancla nueva juntos (se verificó manualmente en producción, falta cubrir en test automatizado).

## Fase 4: Verificación y backfill en datos reales (2026-07-02)

- [x] Deploy a producción confirmado (commit `4f13cda`), `db push` aplicado.
- [x] Backup de la DB antes de cualquier escritura.
- [x] Backfill: 277 trabajadores recibieron `rotationAnchor` (desde slot de junio, o posición actual si no estaban en junio).
- [x] Recálculo de `slotsData` de julio para 58 equipos (solo el campo de patrón, `assignments` no se tocó).
- [x] Re-escaneo: inconsistencias bajaron de 36 a 28 de 58 equipos.
- [x] Categorización de los 28 restantes: 6 por categoría creada después del calendario, 22 sin causa raíz confirmada (deuda histórica, no perseguida más — ver spec.md).
- [x] Verificación con caso limpio (Nissan Irarrázaval 965): coincidencia 100% tras el fix.
- [x] Decisión: no seguir cazando los 22 casos restantes — beneficio bajo, junio es mes cerrado.
