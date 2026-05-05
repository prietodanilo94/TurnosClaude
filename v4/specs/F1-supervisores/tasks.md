# F1 — Tasks

## Fase 1: Modelo de datos
- [ ] Agregar `Supervisor` y `SupervisorBranch` a `prisma/schema.prisma`
- [ ] Migración Prisma (`prisma migrate dev --name add-supervisor`)
- [ ] Actualizar seed/admin inicial si aplica

## Fase 2: Excel sync
- [ ] `parser.ts`: leer columna `Supervisor`, incluir en tipo `ParsedWorker`
- [ ] `sync/route.ts`: crear Supervisor si no existe, linkear SupervisorBranch (idempotente)
- [ ] Test: sync con Excel que tiene supervisores nuevos y repetidos

## Fase 3: Auth supervisor
- [ ] `src/app/api/auth/login/route.ts`: buscar Supervisor por email, generar JWT con `role: supervisor`, `supervisorId`
- [ ] `src/middleware.ts`: proteger `/supervisor/*`
- [ ] JWT payload: documentar campos en tipo `SessionPayload`

## Fase 4: Vista supervisor
- [ ] `src/app/supervisor/page.tsx`: listado de sucursales del supervisor logueado
- [ ] Multi-selección de sucursales + "Ver calendario combinado"
- [ ] `src/app/supervisor/calendario/page.tsx`: calendario con dotación combinada

## Fase 5: Vista admin
- [ ] `src/app/admin/supervisores/page.tsx`: listado de supervisores + sus sucursales
- [ ] Asignar email a supervisor (habilitar login)
- [ ] Asignar/quitar sucursales de supervisor

## Fase 6: QA
- [ ] Test: login supervisor → ve solo sus sucursales
- [ ] Test: admin ve todos los supervisores
- [ ] Test: Excel con `Supervisor` crea/linkea correctamente
