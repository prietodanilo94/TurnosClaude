# F2 — Tasks

- [ ] Agregar `WorkerBlock` a `prisma/schema.prisma`
- [ ] Migración Prisma (`prisma migrate dev --name add-worker-blocks`)
- [ ] `src/app/api/blocks/route.ts`: GET (por workerId), POST (crear), DELETE (por id)
- [ ] `generator.ts`: recibir bloques activos y omitir vendedor en días bloqueados
- [ ] UI: listado de bloqueos en panel de vendedor
- [ ] UI: formulario crear bloqueo (motivo, startDate, endDate)
- [ ] `CalendarView.tsx`: celda gris con tooltip en días bloqueados
- [ ] Test: generador no asigna slot a vendedor bloqueado
- [ ] Test: bloqueo parcial de mes (solo algunos días)
