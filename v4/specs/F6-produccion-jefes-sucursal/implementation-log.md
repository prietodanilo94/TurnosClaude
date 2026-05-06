# F6 - Implementation log

Este archivo registra cambios implementados para F6, por que se hicieron, como verificarlos y como revertirlos si una entrega genera problemas.

La idea es que cada bloque de trabajo deje una huella clara antes de pasar a produccion.

## Formato por entrada

Cada entrada debe incluir:

- Fecha.
- Objetivo.
- Archivos tocados.
- Cambio visible para usuario.
- Riesgos o decisiones.
- Verificacion realizada.
- Reversion sugerida.

## 2026-05-06 - Preparacion inicial para jefes/supervisores

### Estado git antes de continuar

- Rama local: `main`.
- HEAD local antes de F6: `159c4d8`.
- Commit base: `159c4d8 v4/fix(supervisor): reutiliza calendario admin`.
- Referencia local `origin/main`: `159c4d8`.
- Estado antes de commitear F6: working tree con cambios sin commit.
- Nota: `git ls-remote origin refs/heads/main` no pudo confirmar GitHub por falla temporal de conexion a `github.com`; se uso la referencia local `origin/main` como base.

Archivos modificados/no commiteados al iniciar esta entrega:

- `CLAUDE.md`
- `v4/frontend/src/app/admin/supervisores/SupervisoresClient.tsx`
- `v4/frontend/src/app/admin/historial/page.tsx`
- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx`
- `v4/frontend/src/app/api/calendars/export/route.ts`
- `v4/frontend/src/app/supervisor/calendario/SupervisorCalendarView.tsx`
- `v4/frontend/src/app/supervisor/calendario/page.tsx`
- `v4/frontend/src/app/supervisor/page.tsx`
- `v4/frontend/src/app/supervisor/SupervisorBranchSelector.tsx`
- `v4/frontend/src/lib/calendar/validation.ts`
- `v4/frontend/src/lib/calendar/validation.test.ts`
- `v4/specs/F6-produccion-jefes-sucursal/spec.md`
- `v4/specs/F6-produccion-jefes-sucursal/tasks.md`
- `v4/specs/F6-produccion-jefes-sucursal/go-live-checklist.md`
- `v4/specs/F6-produccion-jefes-sucursal/implementation-log.md`

### Estado deploy

Esta entrega F6 aun no esta desplegada en servidor.

Antes de deploy faltan estos pasos:

1. Revisar diff final.
2. Crear commit F6.
3. Hacer push a `origin/main`.
4. En servidor `antigravity`, ejecutar `git pull --ff-only origin main`.
5. Reconstruir v4 con `cd /opt/shift-optimizer/v4 && docker compose up -d --build`.
6. Verificar `turnos4.dpmake.cl/login`, `/supervisor` y logs de `v4-frontend-1`.

No hay migracion de base de datos pendiente para esta entrega porque no se cambio `schema.prisma`.

### Objetivo

Avanzar F6 desde documentacion hacia una primera mejora real de produccion: que admin pueda ver rapidamente si supervisores/jefaturas estan listos para operar, y que supervisor vea estados claros en sus sucursales antes de entrar al calendario.

### Archivos tocados

- `CLAUDE.md`
- `v4/specs/F6-produccion-jefes-sucursal/spec.md`
- `v4/specs/F6-produccion-jefes-sucursal/tasks.md`
- `v4/specs/F6-produccion-jefes-sucursal/go-live-checklist.md`
- `v4/specs/F6-produccion-jefes-sucursal/implementation-log.md`
- `v4/specs/F6-produccion-jefes-sucursal/calendar-contract.md`
- `v4/frontend/src/app/admin/supervisores/SupervisoresClient.tsx`
- `v4/frontend/src/app/admin/historial/page.tsx`
- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx`
- `v4/frontend/src/app/api/calendars/route.ts`
- `v4/frontend/src/app/api/calendars/export/route.ts`
- `v4/frontend/src/app/supervisor/page.tsx`
- `v4/frontend/src/app/supervisor/SupervisorBranchSelector.tsx`
- `v4/frontend/src/app/supervisor/calendario/SupervisorCalendarView.tsx`
- `v4/frontend/src/app/supervisor/calendario/page.tsx`
- `v4/frontend/src/lib/calendar/validation.ts`
- `v4/frontend/src/lib/calendar/validation.test.ts`

### Cambio visible para usuario

Admin:

- En `/admin/supervisores` se agregaron tarjetas resumen:
  - Listos para operar.
  - Sin email.
  - Sin clave.
  - Sin sucursales.
- En la tabla de supervisores se agrego columna `Preparacion`.
- Cada supervisor muestra `Listo` o `Requiere datos`.
- Si faltan datos, se muestra una linea breve: `Falta: email, clave, sucursal`, segun corresponda.

Supervisor/jefatura:

- En `/supervisor`, cada sucursal individual muestra un estado:
  - `Sin equipo`
  - `Falta categoria`
  - `Sin vendedores`
  - `No generado`
  - `Calendario guardado`
- Cada grupo muestra resumen agregado:
  - Pendientes de datos.
  - Calendarios pendientes.
  - Listo.
- Si el usuario no tiene sucursales asignadas, ve un mensaje accionable indicando que debe pedir revision en `Admin > Supervisores`.
- Si intenta abrir una sucursal o grupo sin permisos, ve un bloqueo explicito con link de vuelta a `Mis sucursales`.
- Las acciones principales cambian segun estado: `Revisar datos`, `Generar calendario`, `Generar calendarios`, `Ver calendario` o `Ver calendarios`.
- En calendario supervisor se muestra un panel de revision antes de guardar.
- Si hay errores bloqueantes, el calendario supervisor no permite guardar.
- El usuario recibe mensajes claros al guardar o cuando una API falla.

Validaciones agregadas:

- Calendario sin turnos.
- Slot con turnos sin vendedor asignado.
- Vendedor desconocido/inactivo en asignacion.
- Vendedor asignado en mas de un slot.
- Vendedor con turno en dia bloqueado.
- Advertencia por mas de 44 horas semanales planificadas.
- Advertencia por dia con turnos de plantilla sin cobertura asignada.

Historial:

- Se registra `calendar.export` al exportar calendario o Excel RRHH.
- El guardado de calendario registra `validationSummary` con conteo de errores/advertencias y codigos de advertencia.
- El historial admin muestra la accion `Exporto calendario`.

Specs:

- Se creo F6 como carpeta de trabajo para preparacion a produccion.
- Se agrego checklist go-live.
- Se agrego contrato `CalendarView` para evitar calendarios paralelos.
- Se marcaron tareas completadas en F6 `tasks.md` para esta primera entrega.

### Riesgos o decisiones

- El estado de calendario en `/supervisor` se calcula por mes actual.
- `Calendario guardado` significa que al menos un equipo de la sucursal tiene calendario guardado para el mes actual.
- `Falta categoria` aparece si la sucursal no tiene equipos o si algun equipo no tiene categoria.
- Para no duplicar problemas, `Sin equipo` cuenta como un solo pendiente aunque tambien implique que no hay categoria/vendedores.
- No se cambio modelo de datos.
- La validacion bloqueante se aplica al calendario supervisor mediante props de `CalendarView`; admin conserva su flujo historico.
- La exportacion de grupo sigue fuera de esta entrega. Los botones de exportacion supervisor permanecen ocultos mientras no exista export multi-hoja.
- Las advertencias no bloquean guardado; los errores si bloquean en supervisor.

### Verificacion realizada

Comando:

```powershell
npm.cmd run build
npm.cmd test
```

Resultado:

- Build Next.js completo OK.
- TypeScript OK.
- Rutas `/admin/supervisores` y `/supervisor` compilaron.
- Vitest OK: `1` archivo, `3` tests.

### Reversion sugerida

Si hay que revertir solo esta primera implementacion F6 sin tocar otros cambios futuros:

1. Revertir los cambios de UI en:
   - `v4/frontend/src/app/admin/supervisores/SupervisoresClient.tsx`
   - `v4/frontend/src/app/admin/historial/page.tsx`
   - `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx`
   - `v4/frontend/src/app/api/calendars/route.ts`
   - `v4/frontend/src/app/api/calendars/export/route.ts`
   - `v4/frontend/src/app/supervisor/page.tsx`
   - `v4/frontend/src/app/supervisor/SupervisorBranchSelector.tsx`
   - `v4/frontend/src/app/supervisor/calendario/SupervisorCalendarView.tsx`
   - `v4/frontend/src/app/supervisor/calendario/page.tsx`
   - `v4/frontend/src/lib/calendar/validation.ts`
   - `v4/frontend/src/lib/calendar/validation.test.ts`
   - `v4/specs/F6-produccion-jefes-sucursal/calendar-contract.md`
2. Revertir las marcas `[x]` agregadas en:
   - `v4/specs/F6-produccion-jefes-sucursal/tasks.md`
3. Mantener o eliminar la documentacion F6 segun objetivo:
   - Mantener `spec.md`, `tasks.md`, `go-live-checklist.md` si solo se quiere revertir codigo.
   - Eliminar carpeta `v4/specs/F6-produccion-jefes-sucursal/` si se quiere revertir F6 completo.

Si el cambio ya esta commiteado solo con esta entrega, preferir:

```powershell
git revert <commit>
```

Si hay mas cambios mezclados en el mismo commit, revertir archivo por archivo con cuidado y correr build antes de desplegar.
