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

Deploy realizado en servidor `antigravity`.

- Commit desplegado: `f84a629`.
- Commit: `v4/feat(produccion): prepara piloto jefes sucursal`.
- Servidor: `/opt/shift-optimizer`.
- Stack: `v4`.
- Comando deploy: `cd /opt/shift-optimizer/v4 && docker compose up -d --build`.
- Contenedor: `v4-frontend-1` arriba en `0.0.0.0:3014->3014`.
- Dominio verificado: `https://turnos4.dpmake.cl/login` responde `200`.
- Ruta protegida verificada: `https://turnos4.dpmake.cl/supervisor` responde `307` a `/login`, esperado sin sesion.
- Logs recientes: Next arranco correctamente y Prisma confirmo DB en sync.

No hubo migracion de base de datos porque no se cambio `schema.prisma`.

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

## 2026-05-06 - Ajuste UX guardado incompleto e historial

### Objetivo

Corregir dos fricciones detectadas en uso real:

- El supervisor veia un aviso rojo/verde permanente de validacion, demasiado invasivo.
- El link `Ver calendario` del historial admin podia terminar en 404 porque no incluia `teamId`.

### Archivos tocados

- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx`
- `v4/frontend/src/app/supervisor/calendario/SupervisorCalendarView.tsx`
- `v4/frontend/src/app/admin/historial/page.tsx`
- `v4/specs/F6-produccion-jefes-sucursal/tasks.md`
- `v4/specs/F6-produccion-jefes-sucursal/calendar-contract.md`
- `v4/specs/F6-produccion-jefes-sucursal/implementation-log.md`

### Cambio visible para usuario

Supervisor:

- Ya no se muestra el panel de validacion de forma permanente.
- Si faltan vendedores u otros datos, el boton de guardado dice `Guardar version incompleta`.
- Al presionar guardar con problemas, aparece una confirmacion indicando que el calendario esta incompleto.
- Si confirma, se guarda como version incompleta y queda mensaje amarillo de respaldo.
- Si cancela, no se guarda y queda mensaje de guardado cancelado.

Admin historial:

- `Ver calendario` ahora agrega `?team=<teamId>` cuando el log tiene `teamId`.
- Si un log antiguo no tiene `teamId`, el link vuelve a la ficha de sucursal en vez de abrir una URL que genera 404.

### Verificacion realizada

```powershell
npm.cmd test
npm.cmd run build
```

Resultado:

- Vitest OK: `1` archivo, `3` tests.
- Build Next.js completo OK.

### Reversion sugerida

Para revertir solo este ajuste:

1. En `SupervisorCalendarView.tsx`, volver a pasar `showValidationPanel` si se desea el panel permanente.
2. En `CalendarView.tsx`, restaurar el bloqueo directo de guardado cuando `validation.canSave` sea falso.
3. En `historial/page.tsx`, revertir `calendarLink()` al link anterior solo si se corrige de otra forma el requerimiento de `team`.
4. Correr `npm.cmd test` y `npm.cmd run build`.

## 2026-05-06 - Fix historial para calendarios de grupo sin categoria propia

### Objetivo

Corregir un caso real visto en produccion:

- Admin historial enlazaba a un calendario guardado de una sucursal del grupo.
- Ese equipo no tenia `categoria` propia.
- Supervisor si pudo generar porque el flujo agrupado usa la categoria definida en otra sucursal del mismo grupo y area.
- Admin mostraba `Este equipo no tiene categoria de turno asignada` al abrir `Ver calendario`.

### Cambio aplicado

- Se agrego `resolveCalendarDisplayCategory()` para resolver la categoria de visualizacion.
- Si el equipo tiene categoria propia, se usa esa.
- Si el equipo no tiene categoria propia pero ya tiene calendario guardado, se permite usar una categoria de otro equipo del mismo grupo y misma area.
- Si no existe categoria propia ni fallback de grupo, se mantiene el aviso de categoria faltante.
- Se agregaron tests unitarios para cubrir categoria propia, fallback por grupo y rechazo de categoria de otra area/grupo.

### Archivos tocados

- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/page.tsx`
- `v4/frontend/src/lib/calendar/categoryFallback.ts`
- `v4/frontend/src/lib/calendar/categoryFallback.test.ts`
- `v4/specs/F6-produccion-jefes-sucursal/implementation-log.md`

### Verificacion realizada

```powershell
npm.cmd test
npm.cmd run build
```

Resultado:

- Vitest OK: `2` archivos, `6` tests.
- Build Next.js completo OK.

### Reversion sugerida

Para revertir solo este ajuste:

1. Eliminar `categoryFallback.ts` y `categoryFallback.test.ts`.
2. En `page.tsx`, volver a exigir `team.categoria` antes de renderizar `CalendarView`.
3. Correr `npm.cmd test` y `npm.cmd run build`.

## 2026-05-06 - Cierre tecnico F6 antes de F7

### Objetivo

Cerrar pendientes tecnicos de F6 antes de avanzar con F7:

- Convertir pruebas manuales y riesgos conocidos en checklist o tests.
- Registrar intentos de guardado incompleto en historial.
- Mostrar feedback de guardado con nombre de sucursal/grupo.
- Permitir exportacion de grupo como Excel multi-hoja.
- Agregar ayuda corta para jefes/supervisores.

### Archivos tocados

- `v4/frontend/src/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView.tsx`
- `v4/frontend/src/app/admin/historial/page.tsx`
- `v4/frontend/src/app/api/calendars/route.ts`
- `v4/frontend/src/app/api/calendars/export/route.ts`
- `v4/frontend/src/app/api/calendars/export-group/route.ts`
- `v4/frontend/src/app/api/calendars/validation-attempt/route.ts`
- `v4/frontend/src/app/api/calendars/route.test.ts`
- `v4/frontend/src/app/supervisor/SupervisorShell.tsx`
- `v4/frontend/src/app/supervisor/ayuda/page.tsx`
- `v4/frontend/src/app/supervisor/calendario/SupervisorCalendarView.tsx`
- `v4/frontend/src/app/supervisor/calendario/page.tsx`
- `v4/frontend/src/lib/calendar/generator.ts`
- `v4/frontend/src/lib/calendar/generator.test.ts`
- `v4/frontend/src/lib/calendar/teamSplit.ts`
- `v4/frontend/src/lib/calendar/teamSplit.test.ts`
- `v4/frontend/src/middleware.test.ts`
- `v4/specs/F6-produccion-jefes-sucursal/calendar-smoke-checklist.md`
- `v4/specs/F6-produccion-jefes-sucursal/pilot-plan.md`
- `v4/specs/F6-produccion-jefes-sucursal/tasks.md`
- `v4/specs/F6-produccion-jefes-sucursal/implementation-log.md`

### Cambio visible para usuario

- Supervisor ve link `Como usar` en el menu lateral.
- Guardar muestra mensaje final con nombre de sucursal o grupo.
- Si intenta exportar con errores bloqueantes, la app avisa y evita descargar un archivo defectuoso.
- Supervisor puede exportar calendario o RRHH de grupo como Excel multi-hoja.
- Historial muestra si un cambio afecto `grupo` o `sucursal` cuando el flujo envia esa metadata.
- Historial registra intentos de guardado incompleto cancelados o confirmados.

### Verificacion realizada

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Resultado:

- Vitest OK: `6` archivos, `15` tests.
- Build Next.js completo OK.
- `git diff --check` OK.

### Pendientes F6 no tecnicos

Quedan sin marcar tareas que requieren ejecucion manual con usuario/datos reales:

- Validar clicks reales en vendedor, turno y dia/Gantt.
- Confirmar exportacion de calendario por sucursal descargando archivo real.
- Definir 2-3 jefes piloto, credenciales, soporte y feedback.

### Auditoria de supervisores en produccion

Consulta ejecutada contra `v4-frontend-1`:

- Total supervisores: `77`
- Activos: `77`
- Sin email: `76`
- Sin password: `76`
- Sin sucursales: `0`
- Listos para operar: `1`

Esto cierra la auditoria tecnica. La carga de credenciales piloto queda como pendiente operativo de Fase 10.

### Reversion sugerida

Para revertir solo este cierre tecnico:

1. Revertir el commit de esta entrega.
2. Si se revierte archivo por archivo, retirar `export-group`, `validation-attempt`, pagina `supervisor/ayuda`, tests nuevos y el helper `teamSplit`.
3. Volver a ocultar exportacion supervisor si no se quiere usar export grupo.
4. Correr `npm.cmd test` y `npm.cmd run build`.
