# CLAUDE.md — Instrucciones para Claude Code

> Leído automáticamente al iniciar sesión. Reglas y convenciones del repo.

## Contexto

**Shift Optimizer** — Webapp para generar turnos mensuales de ejecutivos respetando legislación laboral chilena, cobertura mínima y reglas de negocio. Edición manual + exportación Excel.

**Usuarios**: administradores (acceso total) y jefes de sucursal (vista restringida).

**Versiones activas**:
- **v1** (`turnos.dpmake.cl`, puerto 3010 / optimizer 8020) — Next.js + FastAPI + Appwrite. Operativa, en mantenimiento.
- **v2** (`turnos2.dpmake.cl`, 3012 / 8022) — Refinamiento del modelo. Appwrite `main-v2`. CP-SAT con restricción consecutivos en ventana deslizante.
- **v3** (`turnos3.dpmake.cl`, 3013) — Playground/optimizer lab. Consume CP-SAT de v2 via `V3_CP_SAT_OPTIMIZER_BASE_URL=https://turnos2.dpmake.cl/api`.
- **v4** (`turnos4.dpmake.cl`, 3014) — App independiente, **no Appwrite**. Next.js 14 + Prisma + SQLite + JWT propio. Foco actual.

## Convenciones

- **Idioma**: código en inglés (`worker`, `branch`, `shift`); UI/docs/specs/comentarios en español.
- **Semana**: lunes a domingo (convención chilena).
- **RUT**: interno `XXXXXXXX-X`; en Excel exportado solo cuerpo numérico.
- **Sensibles**: nunca commitear `.env`, keys, passwords. RUT nunca en URLs.
- **Commits**: `feat(area):`, `fix(area):`, `chore(area):`, `docs(area):`, etc. Para v4: `v4/feat(...)`, `v4/fix(...)`.

## Reglas operativas

- **Después de commit + push**: actualizar sección "Estado actual" abajo y sincronizar servidor (`ssh antigravity` → `git pull` + recrear servicios). Si server está dirty, resolver y documentar antí©s del pull.
- **Specs (v1/v2/v3)**: leer `spec.md`, `plan.md`, `tasks.md`; proponer plan; esperar aprobación; una tarea a la vez. **No implementar fuera de specs sin preguntar.**
- **No tocar sin permiso**: `.env*`, `CLAUDE.md`, `docs/`, `specs/`.
- **Estilo respuestas**: cortas, densas, sin intro ni resumen final. Tablas/bullets solo si aportan.
- **Dudas**: preguntar antes de asumir. Si hay contradicción entre specs/docs, detenerse y reportar.

## Testing

- Frontend: Vitest + Playwright. Backend: pytest >80%.
- Antes de declarar tarea completa: correr tests relevantes.

## Infraestructura

- Appwrite (v1/v2): `https://appwrite.dpmake.cl/v1`, project `69e0f594001ed045d0c5`, DBs `main` (v1) y `main-v2` (v2).
- GitHub: `github.com/prietodanilo94/TurnosClaude`.
- Servidor: `ssh antigravity`, repo en `/opt/shift-optimizer`.
- Deploy: `cd /opt/shift-optimizer && git pull && cd <vN> && docker compose up -d --build`.
- Admin v4: `prieto.danilo94@gmail.com` / `1234`.

---

## v4 — Estado actual (foco)

**Stack**: Next.js 14 (App Router) + Prisma 5 + SQLite + Tailwind. Auth JWT (`jose`) en cookie httpOnly. bcrypt (`bcryptjs`) para password. Sin Appwrite.

**Estructura clave**:
- `v4/frontend/prisma/schema.prisma` — Branch → BranchTeam (areaNegocio + categoria) → Worker + Calendar. `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`.
- `v4/frontend/src/lib/patterns/catalog.ts` — 8 categorías: `ventas_standalone`, `ventas_autopark`, `ventas_mall_7d`, `postventa_vista_hermosa`, `postventa_standalone`, `postventa_cap`, `postventa_mall_mqt`, `postventa_mall_oeste`. `ventas_mall_7d` rotación 4 semanas con S3=36h (restricción legal/interna).
- `v4/frontend/src/lib/calendar/generator.ts` — Determinístico, rota por `(isoWeek + slotOffset) % rotLen`. Alerta para 3 trabajadores con rotación 4-sem; opción slot virtual con 2.
- `v4/frontend/src/lib/excel/parser.ts` — Columnas `Rut`, `Nombre`, `Área`, `Área de Negocio` (acepta `Servicios` como Postventa). Categoría asignada por combinación Sucursal + Área de Negocio.
- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx` — Vistas global + por trabajador. Celdas muestran primer nombre del worker asignado (click = seleccionar slot).
- 2 exports Excel: `plantilla` (slots genéricos) / `asignado` (nombres reales).
- Auth: `/api/auth/login` valida bcrypt, setea cookie. Middleware protege `/admin/*`.

**Despliegue v4 — gotchas conocidos** (NO repetir):
1. Next.js `@next/env` expande `$VAR` en `.env`: escapar bcrypt hash como `\$2a\$12\$...` localmente.
2. Docker Compose expande `$VAR` en `env_file`: en server escribir `$$2a$$12$$...`.
3. Alpine + OpenSSL 3: `binaryTargets` debe incluir `linux-musl-openssl-3.0.x` y `apk add openssl` en runner.
4. `npx prisma` baja v7 (rompe schema v5): copiar `node_modules/prisma` del builder y correr via `node ./node_modules/prisma/build/index.js`.
5. Páginas server con Prisma: `export const dynamic = "force-dynamic"`.
6. `public/` debe existir (con `.gitkeep` si vacío) — Dockerfile lo copia.

**Verificado en producción**: login 200, `/admin`, `/admin/sucursales`, `/admin/dotacion` 200 con cookie; sin cookie → 307 a `/login`. DB en volumen `v4_data:/data/v4.db`.

**Update 2026-04-29 — rediseño UI v4**:
- Calendario: layout semanal ISO (Sem N + rango fechas), colores por slot, modal "Asignar vendedor" (asigna todo el mes), selector mes/año con continuidad, generator extiende a semanas ISO completas.
- Dotación: diff inteligente (nuevos/modificados/desactivar/sucursales nuevas) antes de sync; botón "Ir a Sucursales" tras confirmar.
- Sucursales: categoría editable inline en listado; "Ver calendario" va directo al calendar (omite página intermedia).
- UI: Trabajador → Vendedor en todos los textos.
- Exports: "Exportar Calendario" = visual semanal estilo v1 (xlsx con colores y Hrs Sem); "Exportar Excel" = formato RRHH (RUT sin DV, DIA1-DIA31, `HH:MM a HH:MM`).
- API: `DELETE /api/calendars?id=` para recalcular (borra calendar y regenera limpio).

---

## v1/v2/v3 — Resumen (referencia)

**v1** completa: specs 001 (data-model), 002 (excel-ingestion), 003 (optimizer ILP+greedy), 004 (calendar-ui), 005 (auth), 006 (exceptions), 007 (export-excel), 008 (holidays), 009 (recalculate-partial), 010 (multiple-proposals). Flujo real de calendario funcionando con persistencia Appwrite.

**v2** completa: bootstrap idempotente `main-v2` (`branch_type_config`, `holidays`, `worker_constraints`, `proposals`, `assignments`, `slot_overrides`, `shift_catalog_v2`). Login server-side propio (`v2/frontend/src/app/auth/*`) que evita el problema de origin en Appwrite. Export con overrides+asterisco. Bug consecutivos resuelto en `v2/backend/app/optimizer/ilp.py` con `_add_consecutive_constraints` (ventana deslizante de `dias_max+1`).

**v3** publicada: optimizer-lab en `/admin/optimizer-lab` con modos `heuristic` (TS) y `cp_sat` (HTTP a v2). Genera propuestas semanales 42h, distribuye domingos, valida cobertura. Tests `engine.test.ts` pasan. Specs en `v3/specs/`.

**Catálogos funcionales corregidos** (heredados a v3/v4):
- Ventas Standalone: L-V 09:00-19:00 + S 10:00-14:30. Apertura L-J 09:00-18:30 + V 09:00-18:00. Cierre L-V 10:30-19:00 + S 10:00-14:30.
- Ventas Mall Autopark: L-S 10:00-19:00. T1 = ma-vi 09:30-19:00 + sa 10:00-19:00. T2 = lu-mi 09:30-19:00 + vi 09:30-19:00 + sa 10:00-19:00. Ambos 42h.

**Docs maestros**: `docs/web-app-playbook.md`, `docs/architecture.md`, `docs/math-formulation.md`, `docs/v3-functional-foundation.md`, `docs/v3-technical-design.md`, `docs/mall-turnos-analisis-completo.md`.
