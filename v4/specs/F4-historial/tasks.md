# F4 — Tasks

## Fase 1: Modelo y helper
- [ ] Agregar `AuditLog` a `prisma/schema.prisma`
- [ ] Migración Prisma (`prisma migrate dev --name add-audit-log`)
- [ ] `src/lib/audit/log.ts`: helper `logAction(action, entityType, entityId, metadata, req)`
- [ ] `src/lib/audit/webhook.ts`: POST fire-and-forget a `N8N_WEBHOOK_URL`
- [ ] Agregar `N8N_WEBHOOK_URL=` a `v4/.env.example`

## Fase 2: Instrumentar routes
- [ ] `api/calendars/route.ts` (POST generate, DELETE): llamar `logAction`
- [ ] `api/dotacion/sync/route.ts`: llamar `logAction` con conteo de cambios
- [ ] `api/blocks/route.ts` (POST, DELETE): llamar `logAction`
- [ ] `api/supervisores/` cuando se implementen (F1): llamar `logAction`

## Fase 3: Vista admin
- [ ] `src/app/admin/historial/page.tsx`: tabla paginada con filtros
- [ ] Filtros: sucursal, acción, fecha desde/hasta, usuario
- [ ] Formato de metadata legible en columna "Detalle"

## Fase 4: QA
- [ ] Test: acción registra en DB correctamente
- [ ] Test: webhook falla → no rompe la operación principal
- [ ] Test: filtros de historial funcionan
