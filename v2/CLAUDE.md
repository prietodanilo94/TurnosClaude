# CLAUDE.md — Instrucciones para Claude Code (v2)

> Este archivo es leído automáticamente por Claude Code al iniciar una sesión en este proyecto.
> Contiene las reglas, convenciones y el estado actual del repo v2.

---

## Contexto del proyecto

**Shift Optimizer v2** — Segunda versión de la webapp de generación de turnos mensuales.
Convive con v1 en el mismo repositorio git (`shift-optimizer/`), pero es una aplicación completamente independiente:
- Datos: mismo Appwrite (`appwrite.dpmake.cl`), **nueva base de datos `main-v2`**.
- Dominio: `turnos2.dpmake.cl` (v1 sigue en `turnos.dpmake.cl`).
- Puertos: frontend `:3012`, optimizer `:8022` (v1 usa 3010/8020).
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
| `V_SA_APE` | Apertura | L–J / V | 09:00 | 18:30 / 18:00 | 8.5h / 8h | 1h desc. |
| `V_SA_CIE` | Cierre | L–V | 10:30 | 19:00 | 7.5h | 1h desc. |
| `V_SA_SAB` | Sábado | Sáb | 10:00 | 14:30 | 4.5h | sin desc. |
  
 Semana tipo corregida:
 - apertura = L–J `09:00-18:30` + V `09:00-18:00` = **42h**
 - cierre = L–V `10:30-19:00` + Sáb `10:00-14:30` = **42h**

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
docker compose up                        # levanta frontend (:3012) + optimizer (:8022)
npm run dev --workspace=frontend         # solo frontend
uvicorn app.main:app --reload            # solo backend (en v2/backend)

# Tests
npm test                                 # frontend (vitest)
pytest                                   # backend (en v2/backend)
npm run test:e2e                         # playwright
npm run smoke:optimizer                  # smoke real contra optimize + validate en v2

# Build
docker compose build

# Deploy en servidor
cd /opt/shift-optimizer && git pull && cd v2 && docker compose up -d --build
```

---

## Después de cada commit + push

**REGLA OBLIGATORIA**: Después de hacer commit y push, actualizar la sección "Estado actual del proyecto" en este archivo (`v2/CLAUDE.md`) para reflejar exactamente qué tasks quedaron completas. Esto aplica siempre, sin excepción.

---

**REGLA OBLIGATORIA**: DespuÃ©s de cada commit + push, sincronizar el servidor (`ssh antigravity`) con `git pull` y recrear los servicios necesarios para v2. Si el servidor estÃ¡ "dirty" (working tree con cambios locales), resolverlo antes del pull y dejar documentado en `v2/CLAUDE.md` quÃ© se hizo y por quÃ©.

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

> Update 2026-04-24: se agrego `docs/web-app-playbook.md` en la raiz del repo como marco de trabajo para futuras iteraciones tipo `v3`. No cambia funcionalidad de `v2`, pero deja establecido el orden recomendado `idea -> documentacion tecnica pre-construccion -> construccion`, junto con spec-kit, reglas de arquitectura, testing, deploy y checklist anti-debugging.
> Update 2026-04-24: acceso v2 confirmado nuevamente en entorno real. `turnos2.dpmake.cl/auth/login` ya responde `200`, devuelve `role=admin`, setea `appwrite_session`/`user_role` y esa misma sesion permite consultar `/account` y el documento `users` de `main-v2`. Queda deuda operativa documentada: en `antigravity`, `docker compose build frontend` seguia produciendo un route auth stale; la produccion funcional quedo levantada promoviendo manualmente una imagen `v2-frontend-manual` validada con login real a `v2-frontend:latest` y recreando el servicio.
> Update 2026-04-24: se corrigio el bug que seguia rompiendo `/login` en `turnos2`: Appwrite devolvia `201` pero `secret: ""` en el body, y la route server-side estaba tomando ese string vacio antes que el valor correcto de `x-fallback-cookies`. `v2/frontend/src/app/auth/login/route.ts` ahora toma `payloadSecret` solo si viene no vacio y si no usa `fallbackSecret`; con eso la cookie `appwrite_session` vuelve a emitirse correctamente.
> Update 2026-04-23: se detecto la causa real del bloqueo de login en `turnos2`: Appwrite devolvia `general_unknown_origin` para `turnos2.dpmake.cl` al intentar `POST /account/sessions/email` desde navegador. Como workaround operativo se agregaron `v2/frontend/src/app/auth/login/route.ts` y `logout/route.ts` para crear/cerrar la sesion desde servidor, persistir `appwrite_session` en cookie propia y sincronizar el SDK web con `client.setSession(...)` en `appwrite-client.ts`; `useCurrentUser`, `login/page.tsx`, `admin/layout.tsx` y `jefe/layout.tsx` ya consumen ese flujo.
> Update 2026-04-23: spec 004 en progreso; backend optimizer scaffolded, suite `tests/test_optimizer_vm7.py` en verde, indexacion ILP alineada con `weeks` 0-based y JWT Appwrite en v2 ajustado a `X-Appwrite-JWT`.
> Update 2026-04-23: v2 ya tiene `frontend/Dockerfile`, `backend/Dockerfile` y `v2/docker-compose.yml`; el deploy documentado ahora existe como configuracion real del repo.
> Update 2026-04-23: servidor `/opt/shift-optimizer` sincronizado a `origin/main`; v1 quedo actualizado. El despliegue real de v2 sigue bloqueado por falta de `/opt/shift-optimizer/v2/.env` en servidor y por definir una `NEXT_PUBLIC_OPTIMIZER_URL` publica/usable.
> Update 2026-04-23: el bloqueo de compilacion frontend de v2 quedo resuelto localmente; se repusieron modulos reutilizados de calendario/optimizer/export/auth, se alinearon tipos compartidos y `tsc --noEmit -p v2/frontend` pasa limpio.
> Update 2026-04-23: el primer rebuild remoto de v2 ya entra al `next build`; detecto una dependencia faltante real en el contenedor (`@dnd-kit/core`) y se corrigio en `v2/frontend/package.json`.
> Update 2026-04-23: el optimizer remoto reinicio por dependencias Python faltantes (`ortools`, `python-dateutil`, `openpyxl`) y se corrigieron en `v2/backend/requirements.txt`.
> Update 2026-04-23: v2 quedo desplegado en `ssh antigravity`; nginx de `turnos2.dpmake.cl` apunta a `127.0.0.1:3012` y `127.0.0.1:8022`, frontend responde por localhost/nginx y el optimizer responde `200` en `/health` y `405` en `/api/optimize` (route publica alcanzable).
> Update 2026-04-23: se agrego `v2/scripts/smoke-optimizer-v2.ts` y `npm run smoke:optimizer`; smoke real verificado contra `https://turnos2.dpmake.cl/api`: `optimize=200`, `validate=200`, `violations=0`.
> Update 2026-04-23: el backend de export/persistencia quedo alineado con `main-v2`; `Proposal` ahora parsea JSON string de Appwrite, `proposal_fetcher` resuelve horarios desde `shift_catalog_v2`, `excel_exporter` exporta usando horas ya resueltas y `v2/backend/tests/test_export_v2.py` quedo verde en contenedor (`4 passed`).
> Update 2026-04-23: `v2/scripts/bootstrap-appwrite-v2.ts` ahora crea `branch_type_config`, `holidays`, `worker_constraints`, `proposals` y `assignments`, y reaplica permisos por rol. Verificado en `ssh antigravity` sobre `main-v2`.
> Update 2026-04-23: en servidor `v2` requirio `npm install --include=dev` para exponer `tsx` y poder ejecutar `npm run bootstrap:appwrite`; despues de eso el stack quedo rebuildado, `python -m pytest tests/test_export_v2.py -q` paso (`4 passed`), `python -m pytest tests/test_optimizer_vm7.py -q` paso (`6 passed`) y el smoke real `optimize + validate` siguio OK.
> Update 2026-04-23: se abrio el flujo real de calendar-ui en `v2/frontend/src/app/admin/sucursales/*`; `build-payload.ts` y el stack de calendario quedaron alineados a turnos dinamicos (`horario_por_dia`) en lugar del shape legacy `inicio/fin`.
> Update 2026-04-23: frontend v2 verificado localmente con `npm exec --workspace=frontend tsc --noEmit` y `npm run build --workspace=frontend`. En `ssh antigravity` hubo que forzar `docker compose build --no-cache frontend` para invalidar cache y dejar `https://turnos2.dpmake.cl/admin/sucursales` respondiendo `200`.
> Update 2026-04-23: flujo de propuestas/export v2 alineado; `persist-proposals.ts` ahora crea `assignments` al generar, la primera propuesta queda `seleccionada`, `ProposalSelector` persiste cambios de seleccion en Appwrite y `trigger-download.ts` usa `X-Appwrite-JWT`.
> Update 2026-04-23: spec 008 implementada en frontend; `v2/frontend/src/app/admin/sucursales/[branchId]/page.tsx` abre ficha editable de sucursal, permite cambiar `clasificacion` + `tipo_franja`, advierte si ya existen propuestas del mes, actualiza opcionalmente `area_catalog` y escribe `audit_log`.
> Update 2026-04-23: spec 007 implementada en v2 a nivel base; `slot_overrides` entra al bootstrap de Appwrite, el calendario abre menu de override con click derecho sobre slot o dia libre, persiste cambios en Appwrite y permite revertirlos desde la misma UI.
> Update 2026-04-23: spec 009 quedo cerrada del lado backend; `excel_exporter.py` ahora genera encabezado enriquecido, `Turno Base`, horas laborales reales, feriados, dias cerrados y overrides con asterisco + notas. Verificado en `ssh antigravity` con `docker exec v2-optimizer-1 python -m pytest /app/tests/test_export_v2.py -q` (`8 passed`), `test_optimizer_vm7.py` (`6 passed`) y `npm run smoke:optimizer` (`RESULT=OK`).
> Update 2026-04-23: se corrigio el drift operativo de v2; `v2/scripts/seed-holidays.ts` ya existe y `npm run seed:holidays` cargo 2026/2027 en `main-v2`, `frontend/package.json` y CORS quedaron alineados a `3012`, `.env.example` a `8022`, y `v2/backend/tests/test_routes_v2.py` agrega cobertura para autorizacion de `/export` y el caso 422 de `/optimize/partial`. Validado en `antigravity` con `5 passed`, `14 passed` (suite export+optimizer) y smoke `RESULT=OK`.

> Última actualización: 2026-04-23 — v2/feat(shift-catalog): spec 003 completa (catálogo de turnos poblado y tipado)

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
- Scaffolding de Frontend (Next.js) copiado de v1 y adaptado con puerto 3012.
- Scaffolding de Backend preparado (fastapi, uvicorn, config enviroment).
- `appwrite-client.ts`, `use-current-user.ts` (hooks base para React).
- Layouts de roles protegidos por middleware (`/admin`, `/jefe`).
- `deps.py` en FastAPI con verificación de appwrite session (JWT validation).
- Collections adicionales auto-creadas en DB main-v2 (`users` y `branch_managers`).
- `tests/e2e/auth-v2.spec.ts` creado.

#### Spec 002 — excel-ingestion ✅ COMPLETA (tasks 1–6)
- Script de base de datos ampliado para incluir `branches`, `workers` y `audit_log` con sus nuevos atributos (`area_negocio`, `rotation_group`, `clasificacion`).
- Types y dependencias de Sync (models.ts y rut-utils.ts) adaptadas.
- Parser inteligente (`excel-parser.ts`) que ahora lee la columna "Área de Negocio" y la normaliza a minúsculas.
- Motor de diferencias (`compute-diff.ts`) utiliza `lookupArea()` para inferir automáticamente la sucursal de un empleado a partir de su ID de área sin pedir ayuda del usuario, auto-clasificando branches nuevas que están en el catálogo.
- La pantalla de UI unificada (`page.tsx`) fue replicada desde v1 y mejorado su `NewBranchesPanel` y `PreviewTable` para soportar las nuevas variables.

#### Spec 003 — shift-catalog ✅ COMPLETA (tasks 1–5)
- Bootstrapping de `shift_catalog_v2` con todos sus atributos incluyendo json e index.
- Script seeder para poblar 22 turnos distribuidos por rotaciones como `V_M7`, `P_MO`, `V_SA`, etc.
- Funciones en frontend para llamar esta data desde Appwrite devolviendo `ShiftV2` (`lib/shift-catalog.ts`).
- Tipos de TypeScript y Pydantic (`schemas.py`) ampliados y unificados.

### 🔲 Pendiente (Próximos pasos para mañana)

- Spec 009 — export-excel

Nota 2026-04-23:
- Spec 009 backend ya no esta pendiente; solo queda la validacion manual final de descarga Excel desde navegador autenticado en `turnos2.dpmake.cl`.

### En progreso

#### Spec 004 - optimizer
- Backend FastAPI v2 expone `POST /api/optimize`, `POST /api/optimize/partial`, `POST /api/validate` y `POST /api/export`.
- `core/calendar.py` arma `SolverInput` con `rotation_group`, semanas ISO y flags de semana completa.
- Se portaron/adaptaron modelos internos, validadores, exporters y modulos del solver (`greedy`, `ilp`, `lower_bound`, `objective`, `partial`, `scoring`).
- `tests/test_optimizer_vm7.py` cubre 6 casos de V_M7 y actualmente pasa completa.
- `tests/test_export_v2.py` cubre parseo de proposals serializadas, resolucion de horarios desde `shift_catalog_v2`, rechazo de slots sin asignar y export a xlsx; pasa completa en contenedor.
- Se corrigio la inconsistencia de indexacion entre `days` y `weeks` en el ILP.
- Validacion JWT de Appwrite alineada a `X-Appwrite-JWT` en v2.
- Estado remoto: `/opt/shift-optimizer` ya fue sincronizado con `origin/main`, nginx `turnos2.conf` quedo repuntado a `3012/8022` y el stack `v2` esta levantado.
- Estado frontend local: `compute-diff`, `types/models` y el modulo de dotacion quedaron alineados; tambien se restauraron `types/optimizer`, `store/calendar-store`, `lib/calendar/*`, `lib/optimizer/*`, `lib/export/*`, `lib/auth/jefe-user-context` y `features/calendar/PartialRecalculateDialog`.
- Verificacion local: `tsc --noEmit -p v2/frontend` pasa completo.
- Ajuste de dependencias remoto: `v2/frontend/package.json` ahora declara `@dnd-kit/core`, requerido por `CalendarView`, `DayCell` y `ShiftSlot`.
- Ajuste de dependencias backend: `v2/backend/requirements.txt` ahora instala `ortools`, `python-dateutil` y `openpyxl`, requeridos por solver/export.
- Infra de despliegue agregada: `v2/docker-compose.yml`, `v2/frontend/Dockerfile`, `v2/backend/Dockerfile`.
- Seguridad de despliegue: el compose de v2 publica `3012` y `8022` solo en `127.0.0.1`; el acceso externo debe pasar por nginx.
- Smoke operacional agregado: `v2/scripts/smoke-optimizer-v2.ts` ejecuta `POST /api/optimize` + `POST /api/validate` con payload VM7 y falla si no hay propuesta valida.
- Persistencia/export v2: `proposals.asignaciones`, `parametros` y `metrics` se parsean correctamente desde Appwrite aunque vengan serializados como string JSON.
- Appwrite `main-v2`: el bootstrap ya deja creadas y con permisos consistentes las colecciones `branch_type_config`, `holidays`, `worker_constraints`, `proposals` y `assignments`.

#### Spec 005 - calendar-ui
- `v2/frontend/src/app/admin/page.tsx` redirige a `/admin/sucursales`.
- `v2/frontend/src/app/admin/sucursales/page.tsx` lista sucursales activas desde Appwrite y muestra conteo de trabajadores.
- `v2/frontend/src/app/admin/sucursales/[branchId]/mes/[year]/[month]/page.tsx` + `CalendarPageClient.tsx` abren el calendario mensual real.
- `v2/frontend/src/lib/proposals/fetch-proposals.ts` y `persist-proposals.ts` conectan el calendario con `proposals` + `assignments`.
- `v2/frontend/src/types/optimizer.ts` y el stack de calendario (`hours-calculator`, `local-validator`, `overlap-detector`, `month-grid`, `calendar-store`, `ShiftSlot`, `WorkerAssignDialog`, `CalendarView`) quedaron alineados a `horario_por_dia`.
- `v2/frontend/src/lib/optimizer/build-payload.ts` ahora deriva `rotation_group`, obtiene turnos reales desde `shift_catalog_v2` y construye `franja_por_dia` dinamica.
- `v2/frontend/src/lib/proposals/persist-proposals.ts` ahora crea `assignment` docs por slot al generar y deja la primera propuesta en estado `seleccionada`.
- `v2/frontend/src/lib/proposals/select-proposal.ts` + `ProposalSelector.tsx` persisten el cambio de propuesta activa en Appwrite.
- `v2/frontend/src/lib/export/trigger-download.ts` usa `X-Appwrite-JWT`, que es el header requerido por el backend v2.
- Verificacion local: `tsc --noEmit` y `next build` OK.
- Estado remoto: `turnos2.dpmake.cl/admin/sucursales` responde `200` despues de pull + rebuild forzado sin cache del frontend.

#### Spec 008 - branch-edit
- `v2/frontend/src/app/admin/sucursales/[branchId]/page.tsx` + `BranchDetailClient.tsx` agregan ficha de sucursal editable para admin.
- El admin puede cambiar `clasificacion`, recibir autocompletado de `tipo_franja` y sobreescribirlo manualmente.
- La ficha muestra advertencia si ya existen propuestas del mes actual para la sucursal.
- El guardado actualiza `branches` y, si el checkbox esta activo, tambien `area_catalog`.
- Cada cambio deja registro en `audit_log`.
- El listado `v2/frontend/src/app/admin/sucursales/page.tsx` ahora enlaza tanto a la ficha como al calendario.
- Verificacion local: `next build` OK y la ruta dinamica `/admin/sucursales/[branchId]` aparece en el output de Next.

#### Spec 007 - overrides
- `v2/scripts/bootstrap-appwrite-v2.ts` ahora crea la coleccion `slot_overrides` y aplica permisos por rol.
- `v2/frontend/src/components/calendar/OverrideMenu.tsx` agrega menu para `cambiar_turno`, `marcar_libre`, `marcar_trabajado` y `proteger_domingo`.
- `v2/frontend/src/components/calendar/CalendarView.tsx` persiste el override en Appwrite, actualiza `proposals.asignaciones`, deja audit log y soporta revertir el override activo.
- `v2/frontend/src/lib/proposals/fetch-slot-overrides.ts` + `calendar-store.ts` cargan y mantienen overrides por propuesta activa.
- `MonthGrid`, `WeekRow`, `DayCell` y `ShiftSlot` muestran icono de override y permiten abrir el menu contextual sobre slot trabajado o dia libre.
- Verificacion local: `next build` OK; la ruta mensual del calendario sigue compilando con el menu nuevo.

#### Spec 009 - export-excel
- `v2/backend/app/services/excel_exporter.py` exporta encabezado enriquecido, `Turno Base`, horarios legibles, `Horas Mes`, `FERIADO`, dia cerrado `—` y notas de override.
- `v2/backend/app/services/proposal_fetcher.py` resuelve metadata extra para export: `branch_clasificacion`, `area_negocio_label`, `worker_slot_by_id`, feriados, dias cerrados y overrides.
- `v2/backend/app/services/appwrite_client.py` agrega lectura de `holidays`, `slot_overrides` y workers activos por sucursal.
- `v2/backend/app/models/schemas.py` incorpora `OverrideType`, `SlotOverride`, `clasificacion` en `Branch` y metadata adicional en `Worker`.
- `v2/backend/tests/test_export_v2.py` ahora cubre 8 casos: parseo JSON, horarios resueltos, rechazo de slots sin asignar, override con asterisco, horas laborales, domingo visible, dia cerrado y feriado.
- Verificacion remota: `test_export_v2.py` 8/8, `test_optimizer_vm7.py` 6/6 y `npm run smoke:optimizer` OK en `ssh antigravity`.

### Infraestructura

- Appwrite: `https://appwrite.dpmake.cl/v1` ✅ (mismo que v1)
- Appwrite Project ID: `69e0f594001ed045d0c5` (mismo que v1)
- Database v2: `main-v2` ✅ creada y bootstrap idempotente operativo
- Dominio: `turnos2.dpmake.cl` ✅ configurado en nginx
- Puertos v2: frontend `:3012`, optimizer `:8022`
- GitHub: mismo repo `github.com/prietodanilo94/TurnosClaude`, subcarpeta `v2/`
- Repo en servidor: `/opt/shift-optimizer/v2`
- Deploy: `cd /opt/shift-optimizer && git pull && cd v2 && npm install --include=dev && npm run bootstrap:appwrite && docker compose up -d --build`

> Update 2026-04-24: se agrego `docs/v3-functional-foundation.md` en la raiz del repo como base funcional de `v3`. No cambia el comportamiento de `v2`, pero consolida las decisiones de producto ya levantadas desde `v2` para pasar luego a diseno tecnico de una nueva version sin Appwrite como centro obligatorio.
> Update 2026-04-24: `docs/v3-functional-foundation.md` se refino con reglas ya cerradas desde negocio: clasificacion inicial de sucursal al importar, dotacion basada en trabajadores activos, plantillas rotativas balanceadas y solver restringido a sucursales con operacion dominical.
> Update 2026-04-24: se cerraron mas decisiones del documento funcional de `v3`: el catalogo de tipos de sucursal actual se toma como completo, la plantilla de 4 semanas queda como unica opcion base sin solver por ahora y las exportaciones de `v3` heredaran los formatos ya existentes en `v1/v2`.
> Update 2026-04-24: se agrego `docs/v3-technical-design.md` en la raiz del repo para formalizar la arquitectura propuesta de `v3`: web app publica en Next.js, PostgreSQL como fuente unica de verdad, servicio Python privado para optimizacion y frontend similar en esencia a `v1/v2`.
> Update 2026-04-24: se agrego `v3/specs/001-optimizer-playground/` y `v3/specs/README.md` para arrancar `v3` con una estrategia `optimizer-first`: primero una pantalla de laboratorio del solver con seleccion de dotacion y diagnostico, antes de construir el flujo completo.
> Update 2026-04-24: se implemento la primera slice tecnica de `v3` en `v3/frontend`: ruta `/admin/optimizer-lab`, API interna `POST /api/optimizer-lab`, formulario de dotacion/parametros y motor inicial para `ventas_mall_dominical` con diagnostico y grilla de slots anonimos. No cambia `v2`, pero ya convierte `v3` en una base ejecutable y no solo documental.
