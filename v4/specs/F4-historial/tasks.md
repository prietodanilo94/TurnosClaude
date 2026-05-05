# F4 — Tasks

## Fase 1: Modelo y helper
- [x] Agregar `AuditLog` a `prisma/schema.prisma`
- [x] Schema aplicado en DB (via `prisma db push`)
- [x] `src/lib/audit/log.ts`: helper `logAction()` — obtiene sesión, guarda en DB, dispara webhook
- [x] `src/lib/audit/webhook.ts`: POST fire-and-forget a `N8N_WEBHOOK_URL`; acciones notificables: `calendar.generate`, `calendar.delete`, `dotacion.sync`
- [x] `N8N_WEBHOOK_URL=` en `v4/.env.example`

## Fase 2: Routes instrumentadas
- [x] `api/calendars/route.ts`: `logAction` en generate y delete
- [x] `api/dotacion/sync/route.ts`: `logAction` con conteo de cambios
- [x] `api/blocks/route.ts`: `logAction` en worker.block y worker.unblock
- [x] `api/supervisores/route.ts`: `logAction` en supervisor.create y supervisor.link

## Fase 3: Vista admin
- [x] `src/app/admin/historial/page.tsx`: tabla paginada (50/pág) con filtros por sucursal, acción, usuario, fecha desde/hasta
- [x] Link "Historial" en nav de AdminShell

## Estado: COMPLETO ✓
