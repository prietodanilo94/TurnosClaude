# F1 — Tasks

## Fase 1: Modelo de datos
- [x] Agregar `Supervisor` y `SupervisorBranch` a `prisma/schema.prisma`
- [x] Schema aplicado en DB (via `prisma db push`)

## Fase 2: Excel sync
- [x] `parser.ts`: leer columna `Supervisor`, incluir en `WorkerRow`
- [x] `sync/route.ts`: crear Supervisor si no existe, linkear SupervisorBranch (idempotente)
- [x] `src/lib/supervisors.ts`: helpers `normalizeSupervisorName` y `supervisorLookupKey`

## Fase 3: Auth supervisor
- [x] `src/app/api/auth/login/route.ts`: buscar Supervisor por email, generar JWT con `role: supervisor`, `supervisorId`
- [x] `src/middleware.ts`: proteger `/supervisor/*`
- [x] Retrocompatibilidad: `User` (legacy) también autentifica como supervisor

## Fase 4: Vista supervisor
- [x] `src/app/supervisor/page.tsx`: listado de sucursales del supervisor logueado
- [x] `SupervisorBranchSelector.tsx`: multi-selección de sucursales + botón "Ver calendario"
- [x] `src/app/supervisor/calendario/page.tsx`: calendario combinado de sucursales seleccionadas
- [x] Soporte bloques de vendedores en vista supervisor

## Fase 5: Vista admin
- [x] `src/app/admin/supervisores/page.tsx`: listado con tabla de supervisores
- [x] `SupervisoresClient.tsx`: formulario crear/editar, asignar sucursales, toggle activo, eliminar
- [x] `src/app/api/supervisores/route.ts`: GET + POST
- [x] `src/app/api/supervisores/[id]/route.ts`: PATCH + DELETE
- [x] Link "Supervisores" en nav de AdminShell
- [x] AdminShell renombrado a "Shift Planner"

## Fase 6: Audit
- [x] `logAction` en creación de supervisor y link supervisor-sucursal (desde admin y desde Excel sync)

## Estado: COMPLETO ✓
