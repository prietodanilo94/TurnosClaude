# F8 — Tasks

## Fase 1: Ownership en rutas de exportación (CRÍTICO)

- [ ] Agregar `assertTeamAccess` a `GET /api/calendars/export`. (src/app/api/calendars/export/route.ts)
- [ ] Agregar verificación de pertenencia a `GET /api/calendars/export-group` — cada teamId del array debe pertenecer al supervisor. (src/app/api/calendars/export-group/route.ts)
- [ ] Filtrar `GET /api/calendars/export-delta` por sucursales asignadas al supervisor. (src/app/api/calendars/export-delta/route.ts)
- [ ] Agregar `assertTeamAccess` a `PATCH /api/teams/[id]/categoria`. (src/app/api/teams/[id]/categoria/route.ts)
- [ ] Agregar verificación de teamIds a `POST /api/calendars/save-notify`. (src/app/api/calendars/save-notify/route.ts)
- [ ] Agregar verificación de teamId a `POST /api/calendars/validation-attempt`. (src/app/api/calendars/validation-attempt/route.ts)

## Fase 2: tokenVersion en runtime

- [ ] Crear wrapper `requireFreshSession(req)` que llame `isSessionFresh()` para rol supervisor. (src/lib/auth/session.ts)
- [ ] Aplicar wrapper en rutas de escritura de supervisor: save, save-notify, validation-attempt. (routes afectadas)
- [ ] Agregar test: supervisor con tokenVersion bumped recibe 401 en ruta protegida. (src/lib/auth/session.test.ts)

## Fase 3: `GET /api/attendance` — API key real

- [ ] Agregar validación de header `x-api-key` en el GET handler de attendance. (src/app/api/attendance/route.ts)
- [ ] Agregar `INTERNAL_API_KEY` al `.env.example` (sin valor real) y documentar en runbook.

## Fase 4: Zod validation restante

- [ ] Agregar `SupervisorPatternBodySchema` y usarlo en `POST /api/supervisor/patterns`. (src/lib/db/schemas.ts + route)
- [ ] Agregar `SupervisorCreateBodySchema` y usarlo en `POST /api/supervisores`. (src/lib/db/schemas.ts + route)
- [ ] Agregar `BranchCreateBodySchema` y usarlo en `POST /api/admin/branches`. (src/lib/db/schemas.ts + route)
- [ ] Agregar `GrupoCreateBodySchema` y usarlo en `POST /api/grupos`. (src/lib/db/schemas.ts + route)

## Fase 5: UX — fixes correctitud

- [ ] Ocultar botón "Disolver grupo" en `SupervisorBranchSelector` cuando `role !== "admin"`. (src/components/supervisor/SupervisorBranchSelector.tsx)
- [ ] Corregir link "Equipos sin categoría" en `/admin/datos` para apuntar a `/admin/sucursales` (lista). (src/app/admin/datos/page.tsx)
- [ ] Corregir texto en `/supervisor/ayuda`: aclarar que RRHH no recibe notificación automática con archivo adjunto. (src/app/supervisor/ayuda/page.tsx)

## Fase 6: Exportación vendedor (scope reducido)

- [ ] Agregar `?mode=personal&workerId=...` al endpoint export y filtrar el output a la fila del vendedor. (src/app/api/calendars/export/route.ts + VendedorView.tsx)
- [ ] Verificar que el Excel generado solo contiene el horario del vendedor autenticado.

## Fase 7: Tests faltantes

- [ ] Agregar tests unitarios para `assertBranchAccess` y `assertTeamAccess` con Prisma mockeado. (src/lib/auth/ownership.test.ts)
- [ ] Agregar tests para las 7 reglas de validación sin cobertura: `weekly_hours_high`, `consecutive_days_exceeded`, `sundays_off_insufficient`, `empty_calendar`, `duplicate_worker`, `unknown_worker`, `day_without_coverage`. (src/lib/calendar/validation.test.ts)
- [ ] Agregar tests para `applyWorkerBlocksToSlots` y `buildWorkerBlockDateMap`. (src/lib/calendar/generator.test.ts o blocks.test.ts)
- [ ] Agregar tests edge-case para `buildIsoWeeks`: mes que empieza lunes, mes que termina domingo, febrero bisiesto. (src/lib/calendar/calendar-utils.test.ts)
- [ ] Agregar test `middleware.ts`: ruta API no registrada → 403, vendedor en ruta supervisor → 403. (src/middleware.test.ts)
