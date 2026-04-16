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

## Cuando tengas dudas

Si una tarea no está clara, **pregunta al usuario** antes de asumir. Mejor una pregunta extra que una implementación incorrecta.

Si detectas una contradicción entre dos specs o entre una spec y `docs/`, **detente y reportalo**.

---

## Estado actual del proyecto

> Última actualización: 2026-04-16

### ✅ Hecho

#### Task 1 — Spec 001 (data-model): Scaffolding base
- `package.json` con scripts npm (`bootstrap:appwrite`, `seed:all`, `create:admin`, etc.)
- `tsconfig.json` configurado para scripts TypeScript con `tsx`
- `.gitignore` (`.env` excluido, `.env.example` incluido)
- `.env.example` con todas las variables necesarias documentadas
- `scripts/hello.ts` — smoke test de entorno (verifica vars de entorno)
- `npm install` corrido → dependencias instaladas (`node-appwrite`, `tsx`, `dotenv`, `typescript`)
- `.env` local creado con credenciales reales (no commiteado)
- Verificado: `npx tsx scripts/hello.ts` imprime correctamente endpoint + project ID

**Pendiente de commit**: esta task está lista para `chore(data-model): scaffolding base del proyecto`

---

### 🔲 Pendiente (en orden)

#### Spec 001 — data-model (continuación)
- [ ] Task 2: `scripts/bootstrap-appwrite.ts` — colecciones `users`, `branches`, `branch_type_config`, `shift_catalog`
- [ ] Task 3: Extender bootstrap con `workers`, `branch_managers`, `holidays`, `worker_constraints`
- [ ] Task 4: Extender con `proposals`, `assignments`, `audit_log`
- [ ] Task 5: Permisos por rol (labels) en cada colección
- [ ] Task 6: `scripts/seed-shift-catalog.ts` (10 turnos)
- [ ] Task 7: `scripts/seed-branch-type-config.ts` (5 tipos de sucursal)
- [ ] Task 8: `scripts/seed-holidays.ts` (2026 + 2027) + `lib/holidays/is-holiday.ts`
- [ ] Task 9: `frontend/src/types/models.ts` — tipos TypeScript
- [ ] Task 10: `backend/app/models/schemas.py` — modelos Pydantic
- [ ] Task 11: `scripts/create-first-admin.ts`
- [ ] Task 12: Actualizar `docs/appwrite-setup.md`

#### Spec 005 — auth-permissions
- [ ] Login con email/password (Appwrite Auth)
- [ ] Middleware de roles (admin / jefe_sucursal)
- [ ] Rutas protegidas en Next.js

#### Spec 002 — excel-ingestion
- [ ] Upload Excel de dotación (SheetJS)
- [ ] Preview y validación antes de sync
- [ ] Sincronización contra colección `workers`

#### Spec 003 — optimizer (backend)
- [ ] FastAPI app con `/health`, `/optimize`, `/validate`
- [ ] Solver Greedy (heurística)
- [ ] Solver ILP con OR-Tools CP-SAT
- [ ] Múltiples propuestas, validación post-solución
- [ ] Dockerfile + docker-compose.yml

#### Spec 004 — calendar-ui
- [ ] Calendario mensual con FullCalendar
- [ ] Drag & drop de turnos
- [ ] Contador de horas en vivo por semana
- [ ] Validaciones visuales (rojo = violación)

#### Spec 010 — multiple-proposals
- [ ] Guardar N propuestas en `proposals`
- [ ] Selector de propuesta para jefe de sucursal

#### Spec 006 — exceptions
- [ ] UI para excepciones individuales (vacaciones, días prohibidos, turnos prohibidos)

#### Spec 009 — recalculate-partial
- [ ] Recálculo del optimizador para un rango de fechas dentro del mes

#### Spec 007 — export-excel
- [ ] Exportación del turnero final a Excel con formato requerido (RUT sin DV, DIA1..DIA31)

---

### Infraestructura
- Appwrite: `https://appwrite.dpmake.cl/v1` — corriendo ✅
- Project ID: `69e0f594001ed045d0c5`
- Database ID: `main` (a crear en bootstrap)
- GitHub: pendiente de conectar
