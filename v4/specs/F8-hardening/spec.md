# F8 — Hardening post-consejo

Hallazgos del council review sobre el branch `worktree-council-improvements`.
Agrupados por área y prioridad. Implementar antes de declarar producción final.

---

## Área 1: Brechas de ownership (CRÍTICO — RUT leak)

Las rutas de exportación y de escritura de supervisores carecen de verificación
de acceso por sucursal/equipo. Un supervisor puede descargar calendarios de
cualquier sucursal o loguear eventos en equipos que no son suyos.

### Rutas afectadas

| Ruta | Problema |
|------|----------|
| `GET /api/calendars/export` | Sin `assertTeamAccess` — descarga RUTs de cualquier sucursal |
| `GET /api/calendars/export-group` | Ídem — acepta array de teamIds sin verificar pertenencia |
| `GET /api/calendars/export-delta` | Retorna todos los calendarios, no filtrado por sucursales del supervisor |
| `PATCH /api/teams/[id]/categoria` | Sin ownership check — cualquier supervisor cambia cualquier equipo |
| `POST /api/calendars/save-notify` | Sin verificar que los `teamIds` del body pertenecen al supervisor |
| `POST /api/calendars/validation-attempt` | Sin verificar que `teamId` pertenece al supervisor |

### Patrón a aplicar

```ts
const session = await getSessionFromRequest(req);
if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
if (!(await assertTeamAccess(session, teamId))) {
  return NextResponse.json({ error: "Sin acceso a este equipo" }, { status: 403 });
}
```

Para rutas con múltiples teamIds: verificar cada uno o verificar el branchId padre.

---

## Área 2: `tokenVersion` no se aplica en runtime

`tokenVersion` se guarda en el JWT al login y se incrementa al cambiar password
(`bumpTokenVersion`). Pero `isSessionFresh()` existe en `session.ts` y nunca es
llamada desde ningún route handler ni middleware.

Resultado: un supervisor cuyo password fue cambiado sigue con cookie válida hasta
expiración natural (12 horas).

### Solución

En cada route handler que llama `getSessionFromRequest`, agregar verificación
de frescura para rol `supervisor`. El middleware Edge no puede usar Prisma, por
lo que la verificación debe vivir en un wrapper de sesión reutilizable.

---

## Área 3: `GET /api/attendance` sin autenticación real

ROUTE_POLICY lo marca como `"api-key"` (middleware omite verificación de sesión
y delega al handler). Pero el handler GET no valida ningún header — cualquier
petición no autenticada puede leer RUT + timestamps de todos los workers de un
equipo.

### Solución

Agregar al inicio del GET handler:
```ts
const apiKey = req.headers.get("x-api-key");
if (apiKey !== process.env.INTERNAL_API_KEY) {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
```

---

## Área 4: Zod validation faltante

Rutas POST/PUT que aún usan validación manual o sin validación estructural:

| Ruta | Estado |
|------|--------|
| `POST /api/supervisor/patterns` | Manual — `rotationWeeks` sin validación de shape |
| `POST /api/supervisores` | Manual — `branchIds` sin validación de elementos |
| `POST /api/admin/branches` | Manual — sin constraints de longitud |
| `POST /api/grupos` | Manual — `branchIds` sin Zod |

---

## Área 5: UX — botón "Disolver grupo" visible para supervisores

F5 spec: solo admin puede disolver grupos. El componente `SupervisorBranchSelector`
muestra el botón "Disolver grupo" al supervisor. El API sí rechaza la petición si
no es admin, pero la UX es incorrecta — el botón no debería aparecer.

### Solución

Leer el rol de sesión en el componente y ocultar el botón si `role !== "admin"`.

---

## Área 6: Vendedor exporta el calendario completo del equipo

`VendedorView.tsx` botón "Exportar" llama a `/api/calendars/export?teamId=...`
que devuelve todos los slots del equipo con nombre de cada trabajador. Un vendedor
ve los horarios de sus compañeros.

### Solución

Opción A (mínima): agregar `?mode=personal&workerId=...` al export y filtrar
en el server para devolver solo la fila del vendedor.
Opción B: crear una ruta separada `GET /api/calendars/export-personal`.

---

## Área 7: `/admin/datos` — links incorrectos

| Sección | Link actual | Debería ir a |
|---------|------------|--------------|
| Equipos sin categoría | `/admin/sucursales/[id]` | `/admin/sucursales` (lista con editor inline) |
| Supervisores sin email | `/admin/supervisores` (lista completa sin filtro) | `/admin/supervisores?highlight=[id]` o vista filtrada |

---

## Área 8: Texto incorrecto en página de ayuda

`/supervisor/ayuda` dice: "RRHH recibirá una notificación automática con el
calendario adjunto" al guardar. El webhook N8N se dispara en `calendar.generate`
(no save) y no adjunta archivos. El texto debe corregirse para no crear
expectativas falsas.

---

## Área 9: Tests faltantes (alta prioridad)

| Test | Por qué importa |
|------|----------------|
| `assertBranchAccess` / `assertTeamAccess` unit tests | Son el único guard real entre supervisor y datos ajenos |
| `validateCalendarForPublish` — 7 de 10 reglas sin test | Las reglas legales (`weekly_hours_high`, `consecutive_days_exceeded`) no están cubiertas |
| `applyWorkerBlocksToSlots` + `buildWorkerBlockDateMap` | Alimentan la UI de celdas grises — regresión invisible |
| `buildIsoWeeks` edge cases | Usado en todos los exports Excel |
| `middleware.ts` — deny-by-default en rutas API | El camino más crítico del middleware no tiene test |

---

## Fuera de scope (post go-live)

- Badge "Con cambios pendientes" en home supervisor (F6 spec principio 2)
- Renombrar grupo desde UI admin
- Exportación personal del vendedor (Opción B — ruta nueva)
- `DEFAULT_YEAR/MONTH` hardcodeado en `SupervisorBranchSelector`
