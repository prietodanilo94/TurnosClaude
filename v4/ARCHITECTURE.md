# TeamPlanner v4 — Arquitectura y estado del sistema

> Documento de referencia para agentes y desarrolladores. Última actualización: 2026-06-25.
> Estado base: commit `ae60d8bc` (tag: `v4-pre-council-2026-06-25`). Council improvements: branch `worktree-council-improvements`.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| ORM | Prisma 5 + SQLite |
| Auth | JWT (`jose`) en cookie httpOnly, bcrypt (`bcryptjs`) |
| UI | Tailwind CSS 3 |
| Tests | Vitest 2 |
| Deploy | Docker Compose, GitHub Actions → `ghcr.io/prietodanilo94/turnosclaude-v4` |
| Servidor producción | `ssh pompeyo` (2.24.83.13), repo en `/opt/shift-optimizer` |

---

## Estructura de carpetas

```
v4/frontend/
├── prisma/
│   ├── schema.prisma          # Fuente de verdad del modelo de datos
│   └── migrations/            # (vacío — se usa db push)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── admin/             # Páginas admin (server components + *Client.tsx)
│   │   ├── supervisor/        # Páginas supervisor
│   │   ├── vendedor/          # Vista personal del vendedor
│   │   └── api/               # Route handlers (~35 endpoints)
│   ├── components/
│   │   ├── calendar/          # Componentes de calendario (CalendarView, worker-colors)
│   │   ├── ui/                # Componentes UI compartibles
│   │   │   ├── Badge.tsx      # Badge de texto inline (roles, estados)
│   │   │   └── MonthNavigator.tsx  # Navegador mes/año (callback-based)
│   │   └── SemanaPicker.tsx
│   ├── lib/
│   │   ├── audit/             # log.ts, cleanup.ts (TTL 365d), webhook.ts, format.ts
│   │   ├── auth/              # session.ts, roles.ts, route-policy.ts, ownership.ts
│   │   ├── calendar/          # generator.ts, validation.ts, calendar-utils.ts, etc.
│   │   ├── db/
│   │   │   ├── prisma.ts      # Singleton Prisma
│   │   │   ├── schemas.ts     # Zod schemas para columnas JSON (slotsData, assignments, etc.)
│   │   │   └── repository/    # Queries centralizadas: branch.ts, calendar.ts, worker.ts
│   │   ├── excel/             # Parser y exportador Excel
│   │   ├── patterns/          # Catálogo de horarios (catalog.ts)
│   │   ├── shifts/
│   │   │   └── category-registry.ts  # Fuente de verdad de categorías
│   │   └── week-index.ts      # Fórmula de índice de semana para rotaciones
│   ├── middleware.ts           # ROUTE_POLICY deny-by-default para /api/
│   └── types/                 # Tipos TypeScript globales
└── vitest.config.ts
```

---

## Modelo de datos (schema.prisma)

### Entidades principales

```
Branch (sucursal)
  └─ BranchGroup?         (máx 1 grupo por sucursal)
  └─ BranchTeam[]         (un equipo por areaNegocio: "ventas" | "postventa")
       └─ Worker[]         (vendedores activos/inactivos)
       └─ Calendar[]       (calendarios mensuales)
  └─ SupervisorBranch[]   (N supervisores por sucursal)

Supervisor
  └─ SupervisorBranch[]   (N sucursales asignadas)
  └─ ShiftPattern[]       (patrones de turno creados por este supervisor)
  └─ invisible: bool      → oculta de lista UI (no afecta permisos)

Calendar
  └─ slotsData: String    → JSON CalendarSlot[] — PARSEAR CON VALIDACIÓN
  └─ assignments: String  → JSON { [slotNum]: workerId | null }
  └─ assignedCount: Int   → denormalizado; calcular desde assignments al escribir

AttendanceRecord          → EXPERIMENTAL, sin spec activa. No integrado al flujo principal.

AuditLog                  → append-only, sin TTL automático. Crece indefinidamente.
```

### Campos críticos no obvios

| Campo | Modelo | Semántica |
|---|---|---|
| `invisible` | Supervisor | Oculta de lista UI. No afecta login ni acceso. |
| `slotsData` | Calendar | JSON opaco — no tiene validación Zod actualmente. |
| `assignedCount` | Calendar | Denormalizado. Actualizar manualmente al escribir assignments. |
| `rotationJson` | ShiftPattern | JSON WeekPattern[]. Parsear con cuidado — no hay validación estructural. |
| `weeklyHoursJson` | ShiftPattern | Informativo solamente. Calcular horas reales desde DayShift. |
| `areaNegocio` | BranchTeam | String libre. Valores esperados: "ventas", "postventa". Sin constraint. |
| `categoria` | BranchTeam | String opcional. Ver catálogo en `src/lib/patterns/catalog.ts`. |

---

## Lógica de calendarios

### Generación (`src/lib/calendar/generator.ts`)

El generador asigna turnos por semana a cada slot (posición de worker). Pasos:

1. Obtener patrón de turno (`getPatternOrThrow` desde catalog.ts o patternOverride)
2. Calcular rango de días (lunes de la semana del día 1 → domingo de la semana del último día)
3. Para cada slot y cada día, calcular `weekIdx = (isoWeek + slotNum - 1) % rotLen`
4. Asignar `pattern.rotationWeeks[weekIdx][dow]` al día

### Fórmula de índice de semana (`src/lib/week-index.ts`)

```ts
getWeekIndex(monday: Date): number
// = Math.floor(monday.getTime() / (7 * 24 * 3600 * 1000))
```

**⚠️ Esta fórmula NO debe cambiarse a ISO week (date-fns/getISOWeek).**
Los números son distintos para las mismas fechas. Cambiar la fórmula corrompe silenciosamente las rotaciones de todos los calendarios futuros generados.

Anclas verificadas:
- `2026-06-01T00:00:00Z` (lunes) → índice **2943** → `2943 % 4 = 3`
- Cubierto por tests en `src/lib/week-index.test.ts`

### Orden de workers en auto-asignación

Workers ordenados `nombre asc` (formato `APELLIDO NOMBRE`).
Para grupos: sucursales ordenadas `branch.nombre asc`; dentro de cada sucursal, workers `nombre asc`.

---

## Autorización

### ROUTE_POLICY (deny-by-default)

`src/lib/auth/route-policy.ts` define el nivel requerido para cada endpoint `/api/`:

```
"public"   → /api/auth/login, /api/auth/logout (sin autenticación)
"api-key"  → /api/attendance (ruta maneja su propia clave)
"supervisor" → /api/calendars/*, /api/grupos, /api/comments, etc.
"admin"    → /api/dotacion/sync, /api/supervisores, /api/workers, etc.
```

`src/middleware.ts` intercepta todas las rutas `/api/*` y aplica la política. Cualquier ruta no registrada retorna 403 automáticamente.

**Cuando agregas una nueva route.ts:** agregar su entrada en `ROUTE_POLICY` o recibirás 403 en producción.

### Ownership check (supervisor → branch)

`src/lib/auth/ownership.ts`:
- `assertBranchAccess(session, branchId)` — verifica link `SupervisorBranch` en DB
- `assertTeamAccess(session, teamId)` — resuelve branchId y llama assertBranchAccess
- Admins siempre tienen acceso; vendedores nunca
- Usado en `/api/calendars/route.ts` (POST/PUT)

### tokenVersion (revocación de sesiones)

`Supervisor.tokenVersion` (Int, default 0) se incluye en el JWT al login.
Para invalidar todas las sesiones de un supervisor:
```ts
import { bumpTokenVersion } from "@/lib/auth/session";
await bumpTokenVersion(supervisorId);
```
Ya se llama automáticamente en: cambio de contraseña, reset de contraseña, desactivación.
Para verificar frescura en rutas sensibles: `isSessionFresh(session)`.

### Roles

`src/lib/auth/roles.ts` — fuente única de verdad. No hardcodear strings de rol.

---

## API Routes (~35 endpoints)

| Prefijo | Descripción |
|---|---|
| `/api/auth/login` `/logout` | JWT en cookie httpOnly |
| `/api/calendars/` | CRUD calendario, save-notify, export, export-group |
| `/api/dotacion/sync` `/preview` | Importación Excel masiva (solo admin) |
| `/api/workers/` `/api/blocks/` | CRUD workers y bloqueos (solo admin) |
| `/api/supervisores/` | CRUD supervisores con asignación de sucursales (solo admin) |
| `/api/grupos/` | CRUD grupos de sucursales |
| `/api/historial/` | Audit log con filtros |
| `/api/admin/*` | Branches, patterns, attendance, comments, usuarios |

**⚠️ Issue de seguridad conocido:** `/api/dotacion/sync` (operación destructiva masiva) no tiene role check.
Cualquier usuario autenticado puede ejecutarla. Ver sección "Deuda técnica".

### Auth

- JWT en cookie `session` (httpOnly, SameSite=Strict)
- Middleware (`src/middleware.ts`): verifica token para páginas `/admin`, `/supervisor`, `/vendedor`
- Para `/api/`: solo verifica que el token existe — **no verifica role**
- Cada route handler hace su propio check (inconsistente)

---

## Patrones de turno (`src/lib/patterns/catalog.ts`)

Catálogo estático de 19 patrones hardcodeados. Para agregar uno nuevo: editar el archivo y redesplegar.

Estructura de un patrón:
```ts
interface ShiftPatternDef {
  label: string
  areaNegocio: string
  rotationWeeks: WeekPattern[]  // array de N semanas
  fixedSlots?: boolean          // true = no rota, todos usan semana (slotNum-1) % rotLen
}

type WeekPattern = (DayShift | null)[]  // índice 0=Lun..6=Dom
type DayShift = { start: string; end: string }  // "08:00", "17:00"
```

---

## Excel

### Importación (`src/lib/excel/parser.ts`)
Lee columnas: `Rut`, `Nombre`, `Área`, `Área de Negocio`, `Supervisor`.
Transforma "usados" → "Seminuevos" en nombres de sucursal (ver `normalizeBranchName` en sync route).
Sin tests actualmente.

### Exportación (`src/lib/excel/calendarExport.ts`)
Genera `.xlsx` con formato pompeyo. Exportación de grupo (multi-hoja) ya implementada en:
- `src/app/api/calendars/export-group/route.ts`
- `src/lib/excel/calendarExport.ts` → `generateGroupCalendarExcel()`
Pendiente: conectar a la UI de supervisor.

---

## Audit Log (`src/lib/audit/log.ts`)

Función central: `logAction({ action, entityType, entityId, metadata, branchId, req })`.
- Escribe en `AuditLog` vía Prisma
- Fire-and-forget webhook a N8N para acciones notificables
- Incluye `userRole`, `userEmail`, `userId` desde la sesión JWT

Acciones notificables: `calendar.generate`, `calendar.save`, `calendar.delete`, `dotacion.sync`.

**TTL automático:** `pruneAuditLog()` en `src/lib/audit/cleanup.ts` elimina registros > 365 días. Se llama como fire-and-forget en `dotacion.sync`. Sin job scheduler separado.

---

## Grupos de sucursales

- `BranchGroup`: una sucursal pertenece a máx 1 grupo (`Branch.groupId` nullable)
- Supervisor selecciona 2+ sucursales → botón "Asignación de turnos" → crea grupo automáticamente
- Calendario de grupo: siempre unificado por `areaNegocio`
- Solo admin puede disolver grupos (`/admin/grupos`)

---

## Tests

```bash
cd v4/frontend
npx vitest run          # o: npm test
npx vitest run --coverage
```

Tests existentes:
- `src/lib/calendar/generator.test.ts`
- `src/lib/calendar/validation.test.ts`
- `src/lib/calendar/teamSplit.test.ts`
- `src/lib/calendar/categoryFallback.test.ts`
- `src/lib/week-index.test.ts` — pinning tests para fórmula epoch
- `src/lib/calendar/calendar-utils.test.ts` — dowIndex, feriados, shiftDuration
- `src/lib/auth/route-policy.test.ts` — ROUTE_POLICY + roleHasAccess
- `src/lib/db/schemas.test.ts` — Zod parsers (válidos + inválidos)
- `src/lib/shifts/category-registry.test.ts` — no duplicados, isValid*

Sin tests (riesgo alto):
- `src/lib/excel/parser.ts` (Excel sync — entrada de datos principal)
- `src/lib/excel/calendarExport.ts`
- `src/lib/audit/log.ts`
- `src/lib/patterns/catalog.ts`

---

## Deploy

```
git push origin main
→ GitHub Actions (.github/workflows/deploy-v4.yml) detecta cambios en v4/**
→ Build (~4 min) → imagen a ghcr.io/prietodanilo94/turnosclaude-v4 (latest + SHA)
→ SSH a pompeyo → compose pull + up -d + image prune
```

Fallback manual en pompeyo:
```bash
cd /opt/shift-optimizer && git pull
cd v4 && docker compose up -d --build && docker image prune -f
```

Schema changes:
```bash
docker exec v4-frontend-1 node ./node_modules/prisma/build/index.js db push
```

---

## Deuda técnica conocida y plan de mejora

Esta sección documenta decisiones del **council de mejora** (sesión 2026-06-25).
El análisis completo está en los transcripts de la sesión.

### Crítico (P0) — estado post-council

| ID | Item | Estado |
|---|---|---|
| P0-A | Auth deny-by-default: ROUTE_POLICY + middleware + assertBranchAccess | ✅ Implementado |
| P0-B | Zod schemas en JSON DB columns (slotsData, assignments, rotationJson) | ✅ Implementado (28 sites migrados) |
| P0-C | AuditLog TTL 365 días | ✅ pruneAuditLog() en cleanup.ts |
| P0-C | Transacción en dotacion/sync | ⏳ Diferido — SQLite + logAction hacen el wrap complejo |
| P0-C | Fix `applyWorkerBlocksToSlots` | ⏳ Documentado — función exportada pero sin caller externo |
| P1-F | tokenVersion en Supervisor para revocación de JWT | ✅ Implementado + bumpTokenVersion() |

### Estructural (P1) — estado post-council

| ID | Item | Estado |
|---|---|---|
| P1-A | Repository layer (branch, calendar, worker) | ✅ src/lib/db/repository/ |
| P1-B | ShiftCategory registry | ✅ src/lib/shifts/category-registry.ts |
| P1-C | Audit logger centralizado | ✅ Ya existía en src/lib/audit/log.ts |
| P1-D | Extracción week-index.ts | ✅ Con comentario DST + pinning tests |
| P1-E | Component layer (src/components/ui/) | ✅ Badge + MonthNavigator (max 5 cap) |
| P1-F | tokenVersion JWT revocation | ✅ Ver arriba |

### Calidad (P2) — estado post-council

| ID | Item | Estado |
|---|---|---|
| P2-A | Decompose CalendarView.tsx (1,033 líneas) | ⏳ Alta complejidad — ya extraídos WeekBlock, CalendarDialogs, etc. |
| P2-B | calendar-utils.ts deduplicado | ✅ local calendar-utils re-exporta desde lib/ |
| P2-C | Vitest coverage (calendar-utils, route-policy, db/schemas, category-registry) | ✅ 4 suites nuevas |
| P2-D | Export grupo UI | ✅ hideExcelExport=false en supervisor |
| P2-E | Schema comments | ✅ Supervisor.invisible, AttendanceRecord, rotationJson |

### Features pendientes

| Feature | Estado | Prerequisitos |
|---|---|---|
| F5: Export grupo Excel multi-hoja | Backend listo, supervisor puede exportar | — |
| F6: Jefes de sucursal | Planificado | P0-A ✅ + P1-A ✅ + repository layer ✅ |
| Credenciales supervisores | 76 supervisores sin email/password | Fácil — schema preparado |

---

## Decisiones de diseño (no cambiar sin entender el motivo)

### 1. SQLite sobre Postgres
Decisión intencional. El volumen de datos y la concurrencia de escritura son bajos (single-tenant, admin único). SQLite en WAL mode es suficiente. El costo de migración a Postgres no está justificado hoy.

### 2. Fórmula epoch en week-index.ts
Ver sección "Fórmula de índice de semana". Cambiarla rompe rotaciones.

### 3. slotsData como JSON en SQLite
Los datos de un mes de calendario son ~100 KB de JSON. Almacenarlos en columnas relacionales requeriría una tabla con miles de filas y joins complejos. El JSON blob es el trade-off correcto para este modelo de lectura/escritura (se lee y escribe completo).

### 4. Patrones hardcodeados en catalog.ts
19 patrones de turno codificados en TypeScript. El admin no necesita crear patrones nuevos en producción; cuando surja esa necesidad, migrar a DB (ver P1 deuda técnica).

### 5. Fire-and-forget para webhook N8N
El webhook de notificación a N8N usa `void` sin await. Un fallo del webhook no debe bloquear la respuesta al usuario. Si N8N está caído, las notificaciones se pierden silenciosamente — esto es aceptable.

---

## Convenciones de código

- Código en inglés (`worker`, `branch`, `shift`, `supervisor`)
- UI, docs, specs, comentarios en español
- Commits: `v4/feat(area):`, `v4/fix(area):`, `v4/chore(area):`
- Semana: lunes a domingo (convención chilena)
- RUT: interno `XXXXXXXX-X`; en Excel exportado solo cuerpo numérico
- Después de commit: push automático a origin main
- Después de push: deploy automático vía GitHub Actions

---

## Contexto de negocio

**TeamPlanner** gestiona turnos mensuales de vendedores en sucursales de Pompeyo (automotora).

- **Admin**: acceso total (crear/editar todo)
- **Supervisor**: ve y edita sus sucursales asignadas
- **Vendedor**: vista personal de su turno (`/vendedor/[year]/[month]`)

Restricciones legales chilenas que el sistema debe respetar:
- Máx 45h semanales (validación en `validation.ts`)
- Máx 6 días consecutivos trabajados
- Feriados irrenunciables: 1/1, 1/5, 18/9, 19/9, 25/12
- Domingos: al menos 2 libres al mes para ciertos tipos de contrato
