# F2 — Tasks

- [x] Agregar `WorkerBlock` a `prisma/schema.prisma`
- [x] Schema aplicado en DB (via `prisma db push`)
- [x] `src/app/api/blocks/route.ts`: GET (por workerId), POST (crear con validación solapamiento 409), DELETE (por id)
- [x] `generator.ts`: `buildWorkerBlockDateMap`, `isWorkerBlockedOnDate`, `getWorkerBlockReason`, `applyWorkerBlocksToSlots`
- [x] UI: gestión de bloqueos integrada en `WorkerAccessManager` (mismo modal que contraseñas)
- [x] `CalendarView.tsx`: celdas grises con "Bloq." y tooltip en días bloqueados (vista global y por vendedor)
- [x] Vista supervisor: celdas bloqueadas también respetadas en `/supervisor/calendario`
- [x] Audit log: `worker.block` y `worker.unblock` registrados

## Estado: COMPLETO ✓
