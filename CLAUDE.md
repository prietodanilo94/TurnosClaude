# CLAUDE.md — Instrucciones para Claude Code

> Leído automáticamente al iniciar sesión. Reglas y convenciones del repo.

## Contexto

**TeamPlanner** (antes Shift Optimizer / Shift Planner) — Webapp para generar turnos mensuales de vendedores respetando legislación laboral chilena, cobertura mínima y reglas de negocio. Edición manual + exportación Excel.

**Usuarios**: administradores (acceso total), supervisores (vista de sus sucursales), vendedores (vista personal).

**Versión activa**: v4 (puerto 3014). Única versión en este repo. v1/v2/v3 eliminadas — historial disponible en git hasta commit `8d5a119`.

**Servidor de producción activo**: `ssh pompeyo` (`2.24.83.13`) — desde sesión 2026-05-07. Antigravity (`173.212.220.77`) ya no es el destino de deploy de v4.

**Tag de recuperación**: `v4-stable-20260505` — estado estable antes de sesión 2026-05-05/06. Rollback: `git checkout v4-stable-20260505`.

## Convenciones

- **Idioma**: código en inglés (`worker`, `branch`, `shift`, `supervisor`, `group`); UI/docs/specs/comentarios en español.
- **Semana**: lunes a domingo (convención chilena).
- **RUT**: interno `XXXXXXXX-X`; en Excel exportado solo cuerpo numérico. Nunca en URLs.
- **Sensibles**: nunca commitear `.env`, keys, passwords.
- **Commits**: `v4/feat(area):`, `v4/fix(area):`, `v4/chore(area):`, etc.

## Reglas operativas

- **Después de commit**: push a origin main automáticamente.
- **Después de push**: sincronizar **ambos** servidores:
  - `ssh pompeyo` → `cd /opt/shift-optimizer && git pull && cd v4 && docker compose up -d --build`
  - `ssh antigravity` → `cd /opt/shift-optimizer && git pull && cd v4 && docker compose up -d --build`
- **Specs**: leer spec antes de implementar; proponer plan; esperar aprobación; una tarea a la vez.
- **No tocar sin permiso**: `.env*`, `CLAUDE.md`.
- **Estilo respuestas**: cortas, densas, sin intro ni resumen final. Tablas/bullets solo si aportan.
- **Dudas**: preguntar antes de asumir.

## Infraestructura

- GitHub: `github.com/prietodanilo94/TurnosClaude`.
- Servidores producción:
  - `ssh pompeyo` (`2.24.83.13`) — servidor empresa, repo en `/opt/shift-optimizer`
  - `ssh antigravity` (`173.212.220.77`) — servidor personal, repo en `/opt/shift-optimizer`
- Deploy (ambos servidores tras cada push): `cd /opt/shift-optimizer && git pull && cd v4 && docker compose up -d --build`.
- Schema DB: `docker exec v4-frontend-1 node ./node_modules/prisma/build/index.js db push` (después de schema changes).
- Admin v4: `prieto.danilo94@gmail.com` / `1234`.
- N8N: `ssh pompeyo`, stack en `/opt/n8n`. Webhook vía `N8N_WEBHOOK_URL` en `.env`.
- Shared-infra (postgres, redis, rabbitmq): `ssh pompeyo`, stack en `/opt/shared-infra`.

---

## v4 — Estado actual (sesión 2026-05-06)

**Stack**: Next.js 14 (App Router) + Prisma 5 + SQLite + Tailwind. Auth JWT (`jose`) en cookie httpOnly. bcrypt (`bcryptjs`). Sin Appwrite.

**Schema actual** (`v4/frontend/prisma/schema.prisma`):
```
Branch → BranchGroup (optional, groupId nullable)
Branch → BranchTeam (areaNegocio + categoria) → Worker + Calendar
Branch → SupervisorBranch ← Supervisor
Worker → WorkerBlock (bloqueos por fechas)
AuditLog (historial de acciones)
```

**Paleta de colores**: 20 colores en `src/components/calendar/worker-colors.ts` (expandida desde 8).

**Excel sync** (`src/lib/excel/parser.ts`): columnas `Rut`, `Nombre`, `Área`, `Área de Negocio`, `Supervisor`. Al sincronizar crea/linkea supervisores automáticamente. 76 supervisores en producción, ninguno con email/password aún — se asignan desde `/admin/supervisores`.

**Rutas principales**:
- `/admin` — dashboard admin
- `/admin/sucursales` — lista sucursales, categoría editable inline
- `/admin/sucursales/[id]/calendario/[year]/[month]` — calendario completo con edición
- `/admin/supervisores` — CRUD de supervisores (email, password, sucursales asignadas)
- `/admin/grupos` — CRUD de grupos de sucursales
- `/admin/historial` — audit log con filtros por supervisor/sucursal/acción/fecha, link "Ver calendario →"
- `/supervisor` — "Mis sucursales": cards de grupos + sucursales individuales con checkboxes
- `/supervisor/calendario` — calendario combinado del grupo o sucursal, con selector ‹ Mes/Año ›
- `/vendedor/[year]/[month]` — vista personal del vendedor

**Lógica de grupos** (F5 — implementado):
- `BranchGroup`: una sucursal pertenece a máximo UN grupo (`Branch.groupId` nullable).
- Supervisor selecciona 2+ sucursales con checkboxes → botón "Asignación de turnos" → confirm dialog → crea grupo automáticamente con nombre "Sucursal A - Sucursal B".
- Calendario de grupo: SIEMPRE unificado por areaNegocio. Si Citroën (4 workers) + Nissan (3 workers) → 7 slots en una tabla.
- Si una sucursal no tiene categoría, hereda de la otra del grupo (sin mostrar mensaje al usuario).
- GenerateButton genera el calendario combinado, divide slots por equipo (offset), y auto-asigna workers a slots en orden (worker[i] → slot[i+1]).
- Solo admin puede disolver grupos (`/admin/grupos`).

**Bloqueos de vendedores** (F2): `WorkerBlock` (startDate, endDate, motivo). Gestionado desde WorkerAccessManager en detalle de sucursal. Celdas grises en calendario. Validación de solapamiento (409 si hay overlap).

**Historial** (F4): `AuditLog` registra todas las acciones. Webhook fire-and-forget a N8N para acciones notificables (`calendar.generate`, `calendar.delete`, `dotacion.sync`). Vista `/admin/historial` con filtros y link directo al calendario afectado.

**Despliegue v4 — gotchas conocidos** (NO repetir):
1. Next.js expande `$VAR` en `.env`: escapar bcrypt hash como `\$2a\$12\$...` localmente.
2. Docker Compose expande `$VAR` en `env_file`: en server escribir `$$2a$$12$$...`.
3. Alpine + OpenSSL 3: `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` y `apk add openssl` en runner.
4. `npx prisma` baja v7 (rompe schema v5): usar `node ./node_modules/prisma/build/index.js`.
5. Páginas server con Prisma: `export const dynamic = "force-dynamic"`.
6. `public/` debe existir con `.gitkeep`.

---

## Specs v4

Las specs viven en `v4/specs/`. Cada una tiene `spec.md` y `tasks.md`.

| ID | Feature | Estado |
|----|---------|--------|
| F1 | Supervisores como entidad central | **Completo** |
| F2 | Bloqueo de vendedores por rango de fechas | **Completo** |
| F3 | Nombres visibles en calendario | **Completo** |
| F4 | Historial de movimientos + webhook N8N | **Completo** |
| F5 | Grupos de sucursales | **Completo** (core) — pendiente: exportar grupo como Excel multi-hoja |
| F6 | Preparacion produccion jefes de sucursal | **Planificado** |

## Pendiente conocido

- **Produccion jefes de sucursal**: F6 define validaciones, UX, permisos, ayuda y checklist go-live antes de abrir uso masivo.
- **Supervisores sin credenciales**: 76 supervisores en producción importados desde Excel, ninguno con email/password. Asignar desde `/admin/supervisores` → Editar.
- **Categorías faltantes**: algunas sucursales pueden no tener categoría asignada. Asignar desde `/admin/sucursales` (edición inline) antes de generar calendarios.
- **Export grupo**: F5 spec incluye exportar calendario de grupo como Excel multi-hoja — no implementado aún.
- **Calendarios existentes sin workers asignados**: calendarios generados antes de la sesión 2026-05-06 tienen assignments vacíos. Presionar "Regenerar" en `/supervisor/calendario` para re-generar con auto-assign.
