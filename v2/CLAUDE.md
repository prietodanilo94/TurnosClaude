# CLAUDE.md — Instrucciones para Claude Code (v2)

> Este archivo es leído automáticamente por Claude Code al iniciar una sesión en este proyecto.
> Contiene las reglas, convenciones y el estado actual del repo v2.

---

## Contexto del proyecto

**Shift Optimizer v2** — Segunda versión de la webapp de generación de turnos mensuales.
Convive con v1 en el mismo repositorio git (`shift-optimizer/`), pero es una aplicación completamente independiente:
- Datos: mismo Appwrite (`appwrite.dpmake.cl`), **nueva base de datos `main-v2`**.
- Dominio: `turnos2.dpmake.cl` (v1 sigue en `turnos.dpmake.cl`).
- Puertos: frontend `:3011`, optimizer `:8021` (v1 usa 3010/8020).
- Nada se migra de v1. Parte limpio.

### Diferencias clave respecto a v1

| Dimensión | v1 | v2 |
|-----------|----|----|
| Clasificación de sucursal | Admin elige manualmente al subir Excel | Auto-mapeada por código de área (`area_catalog`) |
| Columna Excel nueva | — | `Área de Negocio` (`ventas` \| `postventa`) |
| Modelo de turnos | 10 turnos fijos globales | Turnos por (clasificación × área de negocio) |
| Mall 7 días | No contemplado | 3 turnos: Apertura corta / Cierre corto / Completo |
| Overrides post-cálculo | Solo drag & drop | Menú de override por trabajador × día/semana |
| Edición de franja | No existe | Botón en ficha de sucursal para corregir clasificación |

---

## Stack

- **Frontend**: Next.js 14+ / React / TypeScript / Tailwind / shadcn/ui / FullCalendar / dnd-kit / Zustand
- **Backend optimizador**: Python 3.11+ / FastAPI / Google OR-Tools (CP-SAT) / openpyxl
- **Auth + DB + Storage**: Appwrite (self-hosted, misma instancia que v1, DB `main-v2`)
- **Orquestación**: Docker Compose (`v2/docker-compose.yml`)

---

## Convenciones

### Idioma
- **Código**: inglés (`worker`, `branch`, `shift`, `assignment`).
- **Documentación, specs, UI**: español.
- **Comentarios en código**: español cuando aclara lógica de negocio local.

### Semana laboral
- **Lunes a domingo** (convención chilena).

### Formato de RUT
- Interno: `XXXXXXXX-X` (con guión, DV en mayúsculas).
- En Excel exportado: sin puntos ni DV (solo el cuerpo numérico).

### Datos sensibles
- Nunca commitear `.env`, API keys, passwords.
- RUT puede estar en código (no son secretos) pero **nunca** en URLs.

### Commits
- Prefijos: `v2/feat(area):`, `v2/fix(area):`, `v2/chore(area):`, `v2/docs(area):`.
- El `area` corresponde al número de spec: `area-catalog`, `shift-catalog`, `optimizer`, etc.
- Ejemplo: `v2/feat(shift-catalog): agrega turnos Mall 7 días`.

---

## Modelo de turnos (fuente de verdad)

Los turnos están organizados por **clasificación de sucursal** × **área de negocio**.

### Ventas — Stand Alone

Franjas del local: L–V 09:00–19:00 · Sáb 10:00–14:00 · Dom cerrado.

| ID | Nombre | Días | Inicio | Fin | H. labor | Colación |
|----|--------|------|--------|-----|----------|---------|
| `V_SA_APE` | Apertura | L–V | 09:00 | 17:30 | 7.5h | 1h desc. |
| `V_SA_CIE` | Cierre | L–V | 10:30 | 19:00 | 7.5h | 1h desc. |
| `V_SA_SAB` | Sábado | Sáb | 10:00 | 14:30 | 4.5h | sin desc. |

Semana tipo: 5 × 7.5h + 4.5h = **42h** ✓

### Ventas — Mall sin domingo (Autopark, Mall general)

Franja: L–S 10:00–20:00.

| ID | Nombre | Días | Inicio | Fin | H. labor | Colación |
|----|--------|------|--------|-----|----------|---------|
| `V_ML_APE` | Apertura | L–S | 10:00 | 18:00 | 7h | 1h desc. |
| `V_ML_CIE` | Cierre | L–S | 12:00 | 20:00 | 7h | 1h desc. |

> Autopark tiene variante de cierre: L–V 11:00–19:00 / Sáb 12:00–19:00.

### Ventas — Mall 7 días (Movicenter, Tobalaba, Vespucio, Arauco, Egaña, Sur)

Franja: L–D 10:00–20:00.

| ID | Nombre | Inicio | Fin | H. labor | Uso semanal |
|----|--------|--------|-----|----------|-------------|
| `V_M7_APE` | Apertura corta | 10:00 | 19:00 | 8h | 1–3 días |
| `V_M7_CIE` | Cierre corto | 11:00 | 20:00 | 8h | 1–3 días |
| `V_M7_COM` | Completo | 10:00 | 20:00 | 9h | 2 días |

Semana tipo: 3 × 8h + 2 × 9h = **42h** · 5 días trabajados · 2 libres ✓

> Este es el único segmento con 3 tipos de turno. El solver mezcla los 3 para lograr cobertura 7 días manteniendo las restricciones laborales.

### Postventa — Stand Alone

| ID | Nombre | L–J | Viernes | Sábado |
|----|--------|-----|---------|--------|
| `P_SA_A` | Opción A | 08:30–18:00 | 08:30–17:30 | — |
| `P_SA_B` | Opción B | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### Postventa — Mall Quilín / Movicenter

| ID | Nombre | L–J | Viernes | Sábado |
|----|--------|-----|---------|--------|
| `P_MQ_A` | Opción A | 08:30–18:00 | 08:30–17:30 | — |
| `P_MQ_B` | Opción B | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### Postventa — Mall Tobalaba

| ID | Nombre | L–J | Viernes | Sábado |
|----|--------|-----|---------|--------|
| `P_MT_A` | Opción A | 08:30–18:00 | 08:30–17:30 | — |
| `P_MT_B` | Opción B | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### Postventa — Mall Oeste

| ID | Nombre | L–J | Viernes | Sábado |
|----|--------|-----|---------|--------|
| `P_MO_A` | Opción A | 08:00–17:30 | 08:00–17:00 | — |
| `P_MO_B` | Opción B | 08:00–16:30 | 08:00–16:00 | 09:00–14:00 |

### Postventa — CAP

| ID | Nombre | L–J | Viernes | Sábado |
|----|--------|-----|---------|--------|
| `P_CAP_A` | Opción A | 08:30–18:00 | 08:30–17:30 | — |
| `P_CAP_B` | Opción B | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### Turnos únicos (sin rotación)

| ID | Área | L–J | Viernes |
|----|------|-----|---------|
| `U_BO` | BO Administrativos | 09:00–18:30 | 09:00–18:00 |
| `U_DP` | D y P Vista Hermosa | 08:30–18:00 | 08:30–17:30 |

---

## Catálogo de áreas (seed)

63 áreas pre-mapeadas. Clasificación automática al subir Excel.

### Clasificaciones disponibles

| clasificacion | tipo_franja_v1 | Descripción |
|---------------|----------------|-------------|
| `standalone` | `standalone` | Local propio, sin mall |
| `mall_sin_dom` | `movicenter` | Mall que no abre domingo |
| `mall_7d` | `movicenter` | Mall que abre los 7 días (domingos incluidos) |
| `mall_autopark` | `autopark` | Autopark (formato especial) |

> La columna `tipo_franja` sigue siendo compatible con el motor de v1 para reutilizar las restricciones matemáticas de apertura/cierre.

---

## Flujo de trabajo con specs

**REGLA CRÍTICA**: Antes de implementar cualquier feature:

1. Lee `v2/specs/NNN-feature/spec.md` completo.
2. Lee `v2/specs/NNN-feature/tasks.md`.
3. **Propón un plan** al usuario: archivos a crear/modificar, orden, decisiones técnicas.
4. **Espera aprobación** antes de escribir código.
5. Implementa **una tarea a la vez**.
6. Al terminar cada tarea, muestra el diff y espera commit antes de continuar.

**No implementes features fuera de las specs sin preguntar.**

---

## Orden recomendado de implementación

1. **001** — area-catalog (seed 63 áreas)
2. **006** — auth (idéntico a v1, copiar y adaptar)
3. **002** — excel-ingestion (columna nueva + lookup automático)
4. **003** — shift-catalog (seed turnos v2)
5. **004** — optimizer (motor ILP adaptado + Mall 7d)
6. **005** — calendar-ui (reutiliza componentes de v1)
7. **007** — overrides (menú post-cálculo)
8. **008** — branch-edit (botón editar clasificación)
9. **009** — export-excel

---

## Archivos importantes

- `v2/CLAUDE.md` — este archivo: reglas + estado.
- `v2/docs/architecture.md` — arquitectura técnica.
- `v2/docs/math-formulation.md` — modelo matemático del optimizer.
- `v2/specs/` — todas las specs.

## Archivos que NO tocar sin permiso

- `.env*` (nunca, ni para leer).
- `v2/CLAUDE.md` (solo si el usuario lo pide explícitamente).
- Archivos en `v2/docs/` salvo que la tarea sea actualizar documentación.
- Specs en `v2/specs/`: son el input, no el output. Solo cambiarlos si el usuario lo pide.
- Archivos de v1 (raíz del repo): el v2 vive solo en `v2/`.

---

## Testing

- **Frontend**: Vitest para unit tests, Playwright para E2E.
- **Backend**: pytest con cobertura **> 80%**.
- **Antes de declarar una tarea completa**: correr los tests relevantes y verificar que pasan.
- No marques una tarea como ✅ si los tests no pasan.

---

## Comandos útiles

```bash
# Bootstrap inicial (desde v2/)
npm install                              # deps raíz v2
npm run bootstrap:appwrite               # crea colecciones en DB main-v2
npm run seed:all                         # carga seeds (áreas, turnos, feriados)

# Dev
docker compose up                        # levanta frontend (:3011) + optimizer (:8021)
npm run dev --workspace=frontend         # solo frontend
uvicorn app.main:app --reload            # solo backend (en v2/backend)

# Tests
npm test                                 # frontend (vitest)
pytest                                   # backend (en v2/backend)
npm run test:e2e                         # playwright

# Build
docker compose build

# Deploy en servidor
cd /opt/shift-optimizer && git pull && cd v2 && docker compose up -d --build
```

---

## Después de cada commit + push

**REGLA OBLIGATORIA**: Después de hacer commit y push, actualizar la sección "Estado actual del proyecto" en este archivo (`v2/CLAUDE.md`) para reflejar exactamente qué tasks quedaron completas. Esto aplica siempre, sin excepción.

---

## Estilo de respuestas

- Respuestas cortas y densas. Sin intro ni resumen final.
- Omitir explicaciones obvias; solo info relevante que no está en el código.
- Usar tablas/bullets solo cuando aporten claridad real.

---

## Cuando tengas dudas

Si una tarea no está clara, **pregunta al usuario** antes de asumir. Mejor una pregunta extra que una implementación incorrecta.

Si detectas una contradicción entre dos specs o entre una spec y `v2/docs/`, **detente y repórtalo** antes de continuar.

---

## Estado actual del proyecto

> Última actualización: 2026-04-22 — v2/chore(auth): spec 006 completa (scaffolding frontend/backend y JWT auth)

### ✅ Hecho

#### Spec 001 — area-catalog ✅ COMPLETA (tasks 1–7)
- `v2/package.json` + `v2/tsconfig.json` + `v2/.env.example` + `v2/.gitignore`
- `v2/scripts/bootstrap-appwrite-v2.ts` — crea colección `area_catalog` en DB `main-v2` (idempotente)
- `v2/scripts/seed-area-catalog.ts` — 63 áreas con `clasificacion` y `tipo_franja`
- `v2/frontend/src/types/models.ts` — tipos `AreaCatalog`, `Clasificacion`, `TipoFranja`, stubs `Branch`, `Worker`
- `v2/backend/app/models/schemas.py` — modelos Pydantic equivalentes
- `v2/frontend/src/lib/area-catalog.ts` — `lookupArea()` + `getRotationGroup()`
- `v2/backend/app/services/area_catalog.py` — `lookup_area()` + `get_rotation_group()`

#### Spec 006 — auth ✅ COMPLETA (tasks 1–7)
- Scaffolding de Frontend (Next.js) copiado de v1 y adaptado con puerto 3011.
- Scaffolding de Backend preparado (fastapi, uvicorn, config enviroment).
- `appwrite-client.ts`, `use-current-user.ts` (hooks base para React).
- Layouts de roles protegidos por middleware (`/admin`, `/jefe`).
- `deps.py` en FastAPI con verificación de appwrite session (JWT validation).
- Collections adicionales auto-creadas en DB main-v2 (`users` y `branch_managers`).
- `tests/e2e/auth-v2.spec.ts` creado.

### 🔲 Pendiente

- Spec 002 — excel-ingestion
- Spec 003 — shift-catalog
- Spec 004 — optimizer
- Spec 005 — calendar-ui
- Spec 007 — overrides
- Spec 008 — branch-edit
- Spec 009 — export-excel

### Infraestructura

- Appwrite: `https://appwrite.dpmake.cl/v1` ✅ (mismo que v1)
- Appwrite Project ID: `69e0f594001ed045d0c5` (mismo que v1)
- Database v2: `main-v2` 🔲 por crear
- Dominio: `turnos2.dpmake.cl` 🔲 por configurar en nginx
- Puertos v2: frontend `:3011`, optimizer `:8021`
- GitHub: mismo repo `github.com/prietodanilo94/TurnosClaude`, subcarpeta `v2/`
- Repo en servidor: `/opt/shift-optimizer/v2`
- Deploy: `cd /opt/shift-optimizer && git pull && cd v2 && docker compose up -d --build`
