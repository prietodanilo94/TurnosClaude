# CLAUDE.md — Instrucciones para Claude Code

> Leído automáticamente al iniciar sesión. Reglas y convenciones del repo.

## Contexto

**Shift Planner** (antes Shift Optimizer) — Webapp para generar turnos mensuales de vendedores respetando legislación laboral chilena, cobertura mínima y reglas de negocio. Edición manual + exportación Excel.

**Usuarios**: administradores (acceso total), supervisores (vista de sus sucursales), vendedores (vista personal).

**Versión activa**: v4 (`turnos4.dpmake.cl`, puerto 3014). Única versión en este repo. v1/v2/v3 eliminadas — historial disponible en git hasta commit `8d5a119`.

**Tag de recuperación**: `v4-stable-20260505` — estado estable anterior a refactor de supervisores. Rollback: `git checkout v4-stable-20260505`.

## Convenciones

- **Idioma**: código en inglés (`worker`, `branch`, `shift`, `supervisor`); UI/docs/specs/comentarios en español.
- **Semana**: lunes a domingo (convención chilena).
- **RUT**: interno `XXXXXXXX-X`; en Excel exportado solo cuerpo numérico. Nunca en URLs.
- **Sensibles**: nunca commitear `.env`, keys, passwords.
- **Commits**: `v4/feat(area):`, `v4/fix(area):`, `v4/chore(area):`, etc.

## Reglas operativas

- **Después de commit**: push a origin main automáticamente.
- **Después de push**: sincronizar servidor (`ssh antigravity` → `git pull` + recrear servicios). Si server está dirty, resolver antes del pull.
- **Specs**: leer spec antes de implementar; proponer plan; esperar aprobación; una tarea a la vez. No implementar fuera de specs sin preguntar.
- **No tocar sin permiso**: `.env*`, `CLAUDE.md`.
- **Estilo respuestas**: cortas, densas, sin intro ni resumen final. Tablas/bullets solo si aportan.
- **Dudas**: preguntar antes de asumir. Si hay contradicción entre specs, detenerse y reportar.

## Testing

- Frontend: Vitest + Playwright.
- Antes de declarar tarea completa: correr tests relevantes.

## Infraestructura

- GitHub: `github.com/prietodanilo94/TurnosClaude`.
- Servidor: `ssh antigravity`, repo en `/opt/shift-optimizer`.
- Deploy: `cd /opt/shift-optimizer && git pull && cd v4 && docker compose up -d --build`.
- Admin v4: `prieto.danilo94@gmail.com` / `1234`.
- N8N: disponible para webhooks (historial/notificaciones por mail). Endpoint a configurar en spec F4.

---

## v4 — Estado actual

**Stack**: Next.js 14 (App Router) + Prisma 5 + SQLite + Tailwind. Auth JWT (`jose`) en cookie httpOnly. bcrypt (`bcryptjs`) para password. Sin Appwrite.

**Estructura clave**:
- `v4/frontend/prisma/schema.prisma` — Branch → BranchTeam (areaNegocio + categoria) → Worker + Calendar. `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`.
- `v4/frontend/src/lib/patterns/catalog.ts` — 8 categorías: `ventas_standalone`, `ventas_autopark`, `ventas_mall_7d`, `postventa_vista_hermosa`, `postventa_standalone`, `postventa_cap`, `postventa_mall_mqt`, `postventa_mall_oeste`.
- `v4/frontend/src/lib/calendar/generator.ts` — Determinístico, rota por `(isoWeek + slotOffset) % rotLen`.
- `v4/frontend/src/lib/excel/parser.ts` — Columnas `Rut`, `Nombre`, `Área`, `Área de Negocio`, **`Supervisor`**. Categoría asignada por combinación Sucursal + Área de Negocio.
- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx` — Vistas global + por vendedor.
- Auth: `/api/auth/login` acepta email (admin/supervisor) o RUT (vendedor). Middleware protege `/admin/*` y `/vendedor/*`.
- `Worker.passwordHash String?` — opcional, habilitado por admin/supervisor (WorkerAccessManager).
- `/vendedor/[year]/[month]` — vista mensual personal con semanas ISO, horas/sem, navegación mes.

**Despliegue v4 — gotchas conocidos** (NO repetir):
1. Next.js `@next/env` expande `$VAR` en `.env`: escapar bcrypt hash como `\$2a\$12\$...` localmente.
2. Docker Compose expande `$VAR` en `env_file`: en server escribir `$$2a$$12$$...`.
3. Alpine + OpenSSL 3: `binaryTargets` debe incluir `linux-musl-openssl-3.0.x` y `apk add openssl` en runner.
4. `npx prisma` baja v7 (rompe schema v5): copiar `node_modules/prisma` del builder y correr via `node ./node_modules/prisma/build/index.js`.
5. Páginas server con Prisma: `export const dynamic = "force-dynamic"`.
6. `public/` debe existir (con `.gitkeep` si vacío) — Dockerfile lo copia.

**Verificado en producción**: login 200, `/admin`, `/admin/sucursales`, `/admin/dotacion` 200 con cookie; sin cookie → 307 a `/login`. DB en volumen `v4_data:/data/v4.db`.

**Catálogos de turnos**:
- Ventas Standalone: L-V 09:00-19:00 + S 10:00-14:30. Apertura L-J 09:00-18:30 + V 09:00-18:00. Cierre L-V 10:30-19:00 + S 10:00-14:30.
- Ventas Mall Autopark: L-S 10:00-19:00. T1 = ma-vi 09:30-19:00 + sa 10:00-19:00. T2 = lu-mi 09:30-19:00 + vi 09:30-19:00 + sa 10:00-19:00. Ambos 42h.
- `ventas_mall_7d` rotación 4 semanas con S3=36h (restricción legal/interna).

---

## Specs v4 — Features pendientes

Las specs viven en `v4/specs/`. Cada una tiene `spec.md` y `tasks.md`.

| ID | Feature | Estado | Spec |
|----|---------|--------|------|
| F1 | Supervisores como entidad central (reemplaza jefes de sucursal) | **Completo** | `v4/specs/F1-supervisores/` |
| F2 | Bloqueo de vendedores por rango de fechas | **Completo** | `v4/specs/F2-bloqueos/` |
| F3 | Nombres visibles en calendario | **Completo** | `v4/specs/F3-nombres-calendario/` |
| F4 | Historial de movimientos + webhook N8N | **Completo** | `v4/specs/F4-historial/` |
