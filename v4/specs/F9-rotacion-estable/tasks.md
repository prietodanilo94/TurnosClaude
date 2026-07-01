# F9 — Tasks

## Fase 1: Diseño y validación

- [ ] Confirmar con el usuario: Opción A (ancla persistente, schema) vs Opción B (continuidad por identidad, sin schema).
- [ ] Decidir qué hacer con los calendarios ya generados en junio/julio 2026 que quedaron con datos inconsistentes (¿regenerar, dejar como están, o corregir manualmente los casos reportados?).

## Fase 2: Implementación (si se elige Opción A)

- [ ] Agregar `rotationAnchor Int?` a `Worker` en `schema.prisma`.
- [ ] Backfill: para cada `Worker` activo con al menos un calendario, fijar `rotationAnchor` = su `slotNumber` actual en el calendario más reciente que tenga.
- [ ] Cambiar `generateCalendar` para recibir la rotación por trabajador (no por posición) — probablemente cambiar la firma para aceptar `workers: {id, rotationAnchor}[]` en vez de solo `workerCount: number`.
- [ ] Actualizar `buildSoloBlock` y `buildGroupBlock` (`supervisor/calendario/page.tsx`) para pasar el ancla real de cada trabajador.
- [ ] Actualizar `onRecalculateCalendar` en `SupervisorCalendarView.tsx`.
- [ ] Actualizar `backfill-missing/route.ts` para asignar/leer `rotationAnchor` al crear calendarios nuevos.
- [ ] Al activar/reactivar un trabajador sin ancla, asignarle el primer valor disponible (mismo criterio que hoy, pero fijado una sola vez).

## Fase 3: Tests

- [ ] Test: dos generaciones consecutivas con la MISMA nómina producen el mismo resultado (regresión, ya cubierto indirectamente).
- [ ] Test: un trabajador que sigue activo mantiene el mismo `weekIdx` para la misma fecha aunque la nómina del equipo haya cambiado entre generaciones.
- [ ] Test: un trabajador nuevo recibe un ancla que no colisiona con los anclas ya usados por sus compañeros activos.
- [ ] Test de regresión sobre `teamSplit.ts`/`buildGroupBlock` para confirmar que el fix de F8 (offset) sigue funcionando junto con el ancla nueva.

## Fase 4: Verificación en datos reales

- [ ] Re-correr el script de escaneo (36/58 equipos con slot distinto entre junio/julio) después del fix y confirmar que baja a 0 para generaciones nuevas.
- [ ] Revisar manualmente 2-3 casos reales (incluyendo DFSK/Subaru Mall Plaza Tobalaba) antes de dar por cerrado.
