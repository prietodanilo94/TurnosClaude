# CLAUDE.md — Instrucciones para Claude Code

> Este archivo es leído automáticamente por Claude Code al iniciar una sesión en este proyecto. Contiene las reglas y convenciones del repo.

## Contexto del proyecto

**Shift Optimizer** — Webapp para generar turnos mensuales de ejecutivos de venta de forma matemáticamente óptima, con edición manual asistida y exportación a Excel. Resuelve el problema de asignar turnos respetando la legislación laboral chilena, cobertura mínima de atención, y preferencias de negocio (dotación extra en peak y fines de semana).

**Usuarios**: administradores (acceso total) y jefes de sucursal (vista restringida, solo asignación de nombres).

**Stack**:
- Frontend: Next.js 14+ / React / TypeScript / Tailwind / shadcn/ui / FullCalendar / dnd-kit / Zustand
- Backend optimizador: Python 3.11+ / FastAPI / Google OR-Tools (CP-SAT) / openpyxl
- Auth + DB + Storage: Appwrite (self-hosted)
- Orquestación: Docker Compose

## Convenciones

### Idioma
- **Código**: inglés (`worker`, `branch`, `shift`, `assignment`).
- **Documentación, specs, UI**: español.
- **Comentarios en código**: español permitido cuando aclara lógica de negocio local (ej. "los turnos ≥ 8h descuentan colación").

### Semana laboral
- **Lunes a domingo** (convención chilena). No domingo-sábado.

### Formato de RUT
- Interno: `XXXXXXXX-X` (con guión, DV en mayúsculas).
- En el Excel exportado: sin puntos ni DV (solo el cuerpo numérico).

### Datos sensibles
- Nunca commitear `.env`, API keys, passwords.
- RUT puede estar en código (no son secretos) pero **nunca** en URLs.

### Commits
- Prefijos convencionales: `feat(area):`, `fix(area):`, `chore(area):`, `docs(area):`, `refactor(area):`, `test(area):`.
- El `area` corresponde a la spec: `data-model`, `optimizer`, `calendar`, `auth`, etc.
- Ejemplo: `feat(optimizer): implementa constraint de domingos libres`.

## Flujo de trabajo con specs

**REGLA CRÍTICA**: Antes de implementar cualquier feature, sigue este flujo:

1. Lee `specs/NNN-feature/spec.md` completo.
2. Lee `specs/NNN-feature/plan.md`.
3. Lee `specs/NNN-feature/tasks.md`.
4. **Propón un plan de implementación** al usuario explicando:
   - Qué archivos vas a crear/modificar.
   - En qué orden.
   - Qué decisiones técnicas tomaste (si es que hubo que tomar alguna no documentada).
   - Qué tests agregarás.
5. **Espera aprobación** antes de escribir código.
6. Implementa **una tarea a la vez** (las de `tasks.md`).
7. Al terminar cada tarea, muestra el diff y espera commit del usuario antes de continuar.

**No implementes features que no están en las specs sin preguntar primero.** Si ves una mejora evidente, propónla como sugerencia; no la ejecutes.

## Orden recomendado de implementación

Ver `docs/claude-code-guide.md` sección "Orden recomendado de implementación". Resumen:

1. 008 — holidays
2. 001 — data-model
3. 005 — auth-permissions
4. 002 — excel-ingestion
5. 003 — optimizer (backend)
6. 004 — calendar-ui
7. 010 — multiple-proposals
8. 006 — exceptions
9. 009 — recalculate-partial
10. 007 — export-excel

## Archivos importantes

- `README.md` — Visión general.
- `docs/architecture.md` — Arquitectura técnica.
- `docs/math-formulation.md` — **Fuente de verdad del optimizador.** Cualquier cambio de reglas laborales se refleja aquí primero.
- `docs/appwrite-setup.md` — Setup inicial de Appwrite.
- `docs/claude-code-guide.md` — Guía de uso de este repo con Claude Code.
- `specs/` — Todas las specs.

## Archivos que NO debes tocar sin permiso explícito

- `.env*` (nunca, ni para leer).
- `CLAUDE.md` (este archivo): solo si el usuario lo pide explícitamente.
- Archivos en `docs/` salvo que la tarea sea actualizar documentación.
- Specs en `specs/`: estos son el input, no el output. Solo cambiarlos si el usuario lo pide.

## Testing

- **Frontend**: Vitest para unit tests, Playwright para E2E.
- **Backend**: pytest con cobertura > 80%.
- **Antes de declarar una tarea completa**: correr los tests relevantes y verificar que pasan.

## Comandos útiles

(Se irán llenando a medida que el proyecto crezca. Por ahora placeholders.)

```bash
# Bootstrap inicial
npm install                            # Deps raíz
npm run bootstrap:appwrite             # Crea colecciones (spec 001)
npm run seed:all                       # Carga seeds (shifts, tipos, feriados)

# Dev
docker compose up                      # Levanta optimizer + frontend
npm run dev --workspace=frontend       # Solo frontend
uvicorn app.main:app --reload          # Solo backend (en /backend)

# Tests
npm test                               # Frontend
pytest                                 # Backend (en /backend)
npm run test:e2e                       # Playwright

# Build
docker compose build
```

## Después de cada commit + push

**REGLA OBLIGATORIA**: Después de hacer commit y push, actualizar la sección "Estado actual del proyecto" en este archivo (`CLAUDE.md`) para reflejar exactamente qué tasks quedaron completas. Esto aplica siempre, sin excepción.

**REGLA OBLIGATORIA**: DespuÃ©s de cada commit + push, sincronizar el servidor (`ssh antigravity`) con `git pull` y recrear los servicios necesarios. Si el servidor estÃ¡ "dirty" (working tree con cambios locales), resolverlo antes del pull y dejar documentado en `CLAUDE.md` quÃ© se hizo y por quÃ©.

## Estilo de respuestas

- Respuestas cortas y densas. Sin intro ni resumen final.
- Omitir explicaciones obvias; solo info relevante que no está en el código.
- Usar tablas/bullets solo cuando aporten claridad real.

## Cuando tengas dudas

Si una tarea no está clara, **pregunta al usuario** antes de asumir. Mejor una pregunta extra que una implementación incorrecta.

Si detectas una contradicción entre dos specs o entre una spec y `docs/`, **detente y reportalo**.

---

## Estado actual del proyecto

> Update 2026-04-23: `main` mantiene v1 operativa y v2 ya tiene stack remoto propio (`turnos2.dpmake.cl`, puertos locales 3012/8022 via nginx). El ultimo bloqueo fuerte de v2 quedo reducido al deploy remoto: frontend compila localmente otra vez con `tsc --noEmit -p v2/frontend`.

> Última actualización: 2026-04-19 — commit c342558

### ✅ Hecho

#### Spec 001 — data-model ✅ COMPLETA
- `scripts/bootstrap-appwrite.ts` — 11 colecciones, atributos, índices, permisos (idempotente)
- `scripts/seed-*.ts` — turnos, tipos de sucursal, feriados irrenunciables 2026+2027
- `scripts/create-first-admin.ts` — admin `prieto.danilo94@gmail.com` (id: `69e1d60b002c65becc26`)
- `frontend/src/types/models.ts` + `backend/app/models/schemas.py`

#### Spec 005 — auth-permissions ✅ COMPLETA (tasks 1–15)
- `lib/auth/appwrite-client.ts` — singleton SDK web
- `app/login/page.tsx` — form email/password → sesión → cookie rol → redirect
- `lib/auth/use-current-user.ts` — hook: user, isAdmin, isJefe, authorizedBranchIds
- `src/middleware.ts` — guard `/admin/*` y `/jefe/*`
- `admin/layout.tsx` + `jefe/layout.tsx` — nav lateral + logout + guard de branch
- `backend/app/services/appwrite_jwt.py` + `api/deps.py` — require_auth / require_admin
- `admin/usuarios/` — lista, crear, ver/desactivar jefes
- `admin/usuarios/[id]/sucursales/` — agregar/quitar con historial
- `app/api/admin/create-jefe/route.ts` + `deactivate-jefe/route.ts` — Server Actions con API key
- `scripts/audit-roles.ts` — verifica consistencia labels↔docs↔branch_managers
- `tests/e2e/auth.spec.ts` — 3 tests Playwright (crear jefe, ver sucursales, 403)

#### Spec 002 — excel-ingestion ✅ COMPLETA (tasks 1–8)
- `lib/excel-parser.ts` — SheetJS + validación de encabezados por nombre, normalización Área
- `lib/rut-utils.ts` + `rut-utils.test.ts` — validar/normalizar RUT (módulo 11, DV K)
- `lib/compute-diff.ts` — diff contra branches/workers existentes (nuevo/actualizado/sin_cambios/desactivar)
- `lib/sync-dotacion.ts` — upsert branches → upsert workers → soft-delete → audit_log
- `app/admin/dotacion/page.tsx` + `ExcelDropZone`, `PreviewTable`, `NewBranchesPanel`, `SyncConfirmDialog`
- `lib/dotacion-integration.test.ts` — 8 tests (4 casos: primer upload, no-op, branch nueva, soft-delete)

#### Spec 003 — optimizer ✅ COMPLETA (tasks 1–16; benchmarks docs pendiente)
- `backend/app/main.py` — FastAPI + `/health` + CORS
- `backend/app/optimizer/greedy.py` + `ilp.py` + `lower_bound.py` + `objective.py` + `scoring.py`
- `backend/app/core/calendar.py` + `validators.py`
- `backend/app/api/routes.py` — `/optimize`, `/validate` (greedy + ILP, múltiples propuestas)
- `docker-compose.yml` + Dockerfile
- Tests: `test_greedy`, `test_ilp`, `test_calendar`, `test_validators`, `test_lower_bound`, `test_objective`, `test_scoring`, `test_deps`

#### Spec 004 — calendar-ui ✅ COMPLETA (tasks 1–16)
- `store/calendar-store.ts` — Zustand (branchId, month, proposal, assignments, violations, dirty)
- `lib/calendar/hours-calculator.ts` + `local-validator.ts` + `overlap-detector.ts` (con tests)
- `components/calendar/` — CalendarView, MonthGrid, WeekRow, DayCell, ShiftSlot, WeekHoursSummary, worker-colors
- `components/calendar/WorkerAssignDialog`, ProposalSelector, SaveButton, ExportButton
- `app/admin/sucursales/[branchId]/mes/[year]/[month]/page.tsx` + CalendarClientWrapper
- `tests/e2e/calendar.spec.ts`

#### Spec 006 — exceptions ✅ COMPLETA (tasks 1–11)
- `lib/exceptions/api.ts` + `validation.ts` + `to-optimizer-constraint.ts` (con tests)
- `app/admin/trabajadores/` — listado, ficha, excepciones (ExceptionsList, NewExceptionDialog)
- `app/jefe/trabajadores/[id]/excepciones/page.tsx` — vista read-only
- `lib/optimizer/build-payload.ts` — integra excepciones al payload del optimizer

#### Spec 007 — export-excel ✅ COMPLETA (tasks 1–10)
- `backend/app/services/excel_exporter.py` + `proposal_fetcher.py` + `appwrite_client.py`
- `backend/app/api/routes.py` — endpoint `POST /export`
- `frontend/src/lib/export/trigger-download.ts`
- `backend/tests/test_excel_exporter.py` (15) + `test_export_e2e.py` (16)

#### Spec 010 — multiple-proposals ✅ COMPLETA (tasks 1–13)
- `backend/app/optimizer/scoring.py` — `compute_metrics` (6 métricas)
- `lib/proposals/state-machine.ts` + `api.ts` (con tests: estado, concurrencia, audit)
- `features/proposals/ProposalCard.tsx` + `ProposalMetrics.tsx`
- `app/admin/sucursales/.../propuestas/page.tsx` + `comparar/page.tsx`
- `app/jefe/sucursales/.../seleccionar/page.tsx`

#### Spec 009 — recalculate-partial ✅ COMPLETA (tasks 1–11)
- `backend/app/optimizer/partial.py` — `PartialContext` + `setup_partial_problem`
- `backend/app/optimizer/ilp.py` + `greedy.py` — aceptan `partial_context`
- `backend/app/api/routes.py` — endpoint `POST /optimize/partial`
- `backend/tests/test_partial_optimizer.py` — 12 tests
- `frontend/src/features/calendar/PartialRecalculateDialog.tsx` — rango, workers checkboxes, modo ILP/Greedy
- `frontend/src/lib/optimizer/build-partial-payload.ts` — `buildPartialPayload` (pura) + `callPartialOptimize`
- `frontend/src/lib/optimizer/build-partial-payload.test.ts` — 7 tests
- `frontend/src/store/calendar-store.ts` — `partialReview` state + `enterPartialReview(workersExcluidos)` / `exitPartialReview` / `applyPartialReview`
- `frontend/src/components/calendar/DayCell.tsx` — diff visual: in-range (borde verde + badge "mod") / out-of-range (opacity-40)
- `frontend/src/components/calendar/CalendarView.tsx` — banner revisión, `displayAssignments` merged, botones Aprobar (merge+audit log) / Descartar (restore)

#### Flujo real del calendario ✅
- `frontend/src/app/admin/sucursales/page.tsx` — listado de sucursales activas
- `frontend/src/lib/proposals/fetch-proposals.ts` — lee proposals de Appwrite → `OptimizerProposal[]`
- `frontend/src/lib/proposals/persist-proposals.ts` — guarda resultado del optimizer en `proposals` + `assignments`
- `frontend/src/app/admin/sucursales/[branchId]/mes/[year]/[month]/CalendarPageClient.tsx` — carga datos reales, botón "Generar turnos" si no hay propuestas
- Nav lateral de admin: link Sucursales agregado

---

### 🔲 Pendiente

#### Fix SaveButton ✅
- `worker_id` usa `$id` real de Appwrite (vía `rutToId` map)
- `creada_por` usa `user.$id` real
- Un `assignment` doc por slot único (respeta unique index)
- `asignaciones` JSON incluye `worker_rut` (consistente con `persist-proposals`)

#### Spec 008 — holidays ✅ COMPLETA (tasks 1–8)
- `frontend/src/lib/holidays/api.ts` — `listHolidays` / `createHoliday` / `deleteHoliday`
- `frontend/src/lib/holidays/is-holiday.ts` + `is-holiday.test.ts` (3 tests)
- `frontend/src/app/admin/feriados/page.tsx` — listado agrupado por año
- `frontend/src/app/admin/feriados/components/NewHolidayDialog.tsx` — fecha + nombre, valida duplicados
- `frontend/src/lib/calendar/month-grid.ts` — `isOpen=false` en días feriados (drop bloqueado)
- Nav lateral: link Feriados agregado
- `backend/tests/test_holidays_integration.py` — 3 tests (todos pasan)
- Tasks 5 y 7 ya estaban implementados (`build-payload.ts` y `calendar.py`)

#### Spec 009 task 10 — persistencia recálculo parcial ✅
- `handleApprove` en `CalendarView.tsx` ahora persiste en Appwrite:
  - `updateDocument` en `proposals.asignaciones` con el merge final
  - Upsert de `assignments` docs (slot → `worker_id` real)
  - `markSaved()` limpia dirty flag automáticamente
  - Si Appwrite falla, `dirty=true` queda activo para reintento vía Guardar

---

### Infraestructura
- Appwrite: `https://appwrite.dpmake.cl/v1` — corriendo ✅
- Project ID: `69e0f594001ed045d0c5`
- Database ID: `main` ✅ creado
- GitHub: conectado ✅ — `github.com/prietodanilo94/TurnosClaude`
- Producción: `https://turnos.dpmake.cl` ✅ desplegado en servidor
  - Frontend (Next.js): puerto 3010 → nginx → turnos.dpmake.cl
  - Optimizer (FastAPI): puerto 8020 → nginx /optimizer/
  - Repo en servidor: `/opt/shift-optimizer`
  - Deploy: `cd /opt/shift-optimizer && git pull && docker compose up -d --build`
