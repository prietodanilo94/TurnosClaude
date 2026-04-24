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

> Update 2026-04-24: se creo `docs/web-app-playbook.md` como documento maestro para futuras apps y especialmente para una posible `v3`. Define el marco completo de trabajo: fases `idea -> documentacion pre-construccion -> construccion`, artefactos obligatorios, metodologia spec-kit, reglas de arquitectura, testing, deploy y antipatrones que disparan debugging y consumo de tokens.
> Update 2026-04-24: `v2` ya recupero acceso por login real. Verificado en `turnos2.dpmake.cl`: `POST /auth/login` devuelve `200`, emite `appwrite_session` + `user_role=admin`, y esa sesion autentica correctamente contra Appwrite `/account` y el documento `users` de `main-v2`. Ojo operativo: en `antigravity` el `docker compose build frontend` seguia dejando un bundle stale del route auth; para dejar produccion funcional se construyo manualmente la imagen frontend con el Dockerfile real, se comprobo `POST /auth/login` en un contenedor temporal y luego se promovio esa imagen a `v2-frontend:latest` antes de recrear el servicio.
> Update 2026-04-24: se corrigio el bug real del login server-side en `v2`: Appwrite entrega `secret: ""` en el body de `POST /account/sessions/email`, y eso estaba anulando el valor util de `x-fallback-cookies` por usar `??` sobre string vacio. `v2/frontend/src/app/auth/login/route.ts` ahora prioriza `secret` solo si viene no vacio y, si no, usa el fallback del header; con eso el login vuelve a emitir `appwrite_session` y `user_role`.
> Update 2026-04-23: el problema de acceso en `v2` no era la clave del admin sino Appwrite rechazando el origin `turnos2.dpmake.cl` para `POST /account/sessions/email`. Se implemento un login/logout server-side propio en `v2/frontend/src/app/auth/*` que crea la sesion desde servidor, guarda `appwrite_session` para el browser y sincroniza el SDK web con `client.setSession(...)`; esto destraba `/login` sin depender de registrar manualmente la plataforma web en Appwrite.
> Update 2026-04-23: `main` mantiene v1 operativa y v2 ya quedo desplegada en `turnos2.dpmake.cl` usando puertos locales `3012/8022` via nginx. Verificado: frontend responde por nginx, `/api/optimize` del optimizer queda publico y alcanzable, y el smoke real `optimize + validate` pasa en v2.
> Update 2026-04-23: v2 ya sincroniza `main-v2` con bootstrap idempotente completo; en `ssh antigravity` se crearon `branch_type_config`, `holidays`, `worker_constraints`, `proposals` y `assignments`, y el backend de export quedo alineado con `shift_catalog_v2` y con proposals serializadas desde Appwrite. Verificado en contenedor: `test_export_v2.py` 4/4, `test_optimizer_vm7.py` 6/6 y smoke real `optimize + validate` OK.
> Update 2026-04-23: v2 cerro la spec de export backend; `excel_exporter.py` ahora refleja overrides con asterisco, encabezado enriquecido, `Turno Base`, feriados, dias cerrados y horas laborales reales. Revalidado en `antigravity` con `test_export_v2.py` 8/8, `test_optimizer_vm7.py` 6/6 y smoke `RESULT=OK`.
> Update 2026-04-23: v2 quedo mas coherente operativamente; `seed-holidays.ts` ya existe en `v2`, `npm run seed:holidays` cargo feriados 2026/2027 en `main-v2`, el frontend local usa `3012`, `.env.example` apunta a `8022`, y se agrego `test_routes_v2.py` para cubrir autorizacion de export y el caso 422 de optimize parcial. Validado en `antigravity` con `5 passed`, `14 passed` y smoke `RESULT=OK`.

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
- `v2/frontend/src/app/admin/sucursales/page.tsx` + `v2/frontend/src/app/admin/sucursales/[branchId]/mes/[year]/[month]/page.tsx` — v2 ya expone listado real de sucursales y ruta mensual navegable
- `v2/frontend/src/lib/optimizer/build-payload.ts` + `v2/frontend/src/lib/calendar/shift-utils.ts` — v2 ya arma payload y renderiza calendario usando `horario_por_dia`, no turnos fijos legacy
- `v2/frontend/src/lib/proposals/persist-proposals.ts` + `v2/frontend/src/components/calendar/ProposalSelector.tsx` — v2 deja la propuesta inicial seleccionada, crea `assignments` desde el primer generate y persiste el cambio de propuesta activa en Appwrite
- `v2/frontend/src/lib/export/trigger-download.ts` — export v2 usa `X-Appwrite-JWT`, alineado al backend
- `v2/frontend/src/app/admin/sucursales/[branchId]/page.tsx` — v2 ya tiene ficha de sucursal con edicion de `clasificacion` y `tipo_franja`, advertencia por propuestas existentes y update opcional de `area_catalog`
- `v2/frontend/src/components/calendar/OverrideMenu.tsx` + `v2/scripts/bootstrap-appwrite-v2.ts` — v2 ya soporta overrides post-optimizacion persistidos en `slot_overrides` y reflejados de inmediato en el calendario

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
  - Update 2026-04-23: `turnos2.dpmake.cl/admin/sucursales` quedo operativo despues de `git pull` + rebuild forzado `docker compose build --no-cache frontend && docker compose up -d frontend`

### Update 2026-04-24
- Se agrego `docs/v3-functional-foundation.md` como documento funcional inicial de `v3`: define roles, tipos de sucursal, modos de generacion, reglas de continuidad semanal, slots anonimos, alcance MVP e informacion faltante antes del diseno tecnico.
- Se refino `docs/v3-functional-foundation.md` con decisiones nuevas: clasificacion inicial desde Excel solo una vez, dotacion = trabajadores activos, reparto balanceado de slots en rotativos, solver solo para sucursales con operacion dominical y diagnostico obligatorio cuando no haya solucion factible.
- Se cerraron decisiones funcionales adicionales de `v3`: el catalogo actual de tipos de sucursal se considera completo, la plantilla de 4 semanas es unica por ahora y los dos formatos de exportacion de `v3` reutilizaran los ya existentes en `v1/v2`.
- Se agrego `docs/v3-technical-design.md` como diseno tecnico pre-construccion de `v3`: define arquitectura sin Appwrite como centro, Next.js como backend publico, PostgreSQL como fuente de verdad, servicio Python privado para solver y continuidad del frontend en esencia con `v1/v2`.
- Se agrego `v3/specs/001-optimizer-playground/` y `v3/specs/README.md` para formalizar una estrategia `optimizer-first` en `v3`: primera vertical slice enfocada en una pagina tipo laboratorio donde se elige dotacion y se valida el solver antes del resto del producto.
- Se implemento la primera vertical slice ejecutable de `v3` en `v3/frontend`: app Next.js independiente con landing, layout admin base y ruta `/admin/optimizer-lab`.
- `v3/frontend/src/app/api/optimizer-lab/route.ts` valida requests con `zod` y `v3/frontend/src/lib/optimizer-lab/engine.ts` resuelve un laboratorio inicial para `ventas_mall_dominical` con semanas completas extendidas, diagnostico de factibilidad, dotacion minima sugerida y propuestas por slots anonimos.
- `v3/frontend/src/components/optimizer-lab/OptimizerLabPage.tsx` ya permite elegir categoria, mes, ano, dotacion y parametros clave, y renderiza diagnostico, propuestas y grilla mensual con una UI alineada a la esencia de `v1/v2`.
- Verificacion local de `v3`: `tsc --noEmit` y `next build` pasan sobre `v3/frontend`.
- Se corrigio la definicion funcional heredada de `Ventas Standalone`: horario de funcionamiento `L-V 09:00-19:00` y `S 10:00-14:30`; turno apertura `L-J 09:00-18:30` + `V 09:00-18:00`; turno cierre `L-V 10:30-19:00` + `S 10:00-14:30`. La correccion quedo reflejada en `docs/v3-functional-foundation.md`, `v2/scripts/seed-shift-catalog-v2.ts`, `v2/specs/003-shift-catalog/spec.md` y `v2/CLAUDE.md`.
- Se corrigio la definicion funcional heredada de `Ventas Mall Autopark`: funcionamiento `L-S 10:00-19:00`, `T1` = martes a viernes `09:30-19:00` + sabado `10:00-19:00`, `T2` = lunes a miercoles `09:30-19:00` + viernes `09:30-19:00` + sabado `10:00-19:00`; ambos suman `42h` y se acepta inicio antes de apertura formal para este caso. La correccion quedo reflejada en `docs/v3-functional-foundation.md`, `v2/scripts/seed-shift-catalog-v2.ts`, `v2/specs/003-shift-catalog/spec.md` y `v2/CLAUDE.md`.
- Se reemplazo el motor fijo inicial de `v3/frontend/src/lib/optimizer-lab/engine.ts` por un generador real de propuestas semanales: construye patrones de 42h exactas, distribuye domingos visibles segun dotacion y domingos libres minimos, y filtra solo propuestas con cobertura minima completa en el rango extendido.
- `v3/frontend/src/lib/optimizer-lab/types.ts` y `v3/frontend/src/components/optimizer-lab/OptimizerLabPage.tsx` ahora exponen metricas mas utiles del solver (`minCoverage`, `coverageDeficitDays`, `weeklyHoursBySlot`) para revisar calidad real de cada propuesta en la UI.
- Se agrego `v3/frontend/src/lib/optimizer-lab/engine.test.ts` con 3 pruebas del solver del playground: insuficiencia de dotacion, factibilidad con 42h exactas por semana extendida e imposibilidad cuando se exigen demasiados domingos libres.
- Verificacion actual de `v3`: `tsc --noEmit`, `vitest run src/lib/optimizer-lab/engine.test.ts` y `next build` pasan sobre `v3/frontend`.
- `v3/frontend/src/components/optimizer-lab/OptimizerLabPage.tsx` ahora permite elegir el modo de calculo en la misma pantalla: `Heuristico` o `OR-Tools CP-SAT`.
- `v3/frontend/src/app/api/optimizer-lab/route.ts` despacha ambos modos: el heuristico sigue resolviendose en TypeScript y el modo `cp_sat` llama al optimizer exacto por HTTP usando `V3_CP_SAT_OPTIMIZER_BASE_URL` o, por defecto, `http://127.0.0.1:8022/api`.
- La misma interfaz del playground ya puede calcular de una forma u otra segun el modo elegido; si el backend exacto no esta disponible, la UI devuelve un diagnostico explicito en vez de fallar silenciosamente.
