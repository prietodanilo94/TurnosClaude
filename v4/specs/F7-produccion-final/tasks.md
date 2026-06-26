# F7 - Tasks

## Fase 1: Cierre de brechas F6

- [ ] Revisar `v4/specs/F6-produccion-jefes-sucursal/tasks.md` y marcar que tareas bloquean produccion final.
- [ ] Ejecutar smoke visual/manual para tabs: calendario mensual, turno por vendedor, cobertura del dia.
- [ ] Validar click en vendedor abre modal de asignacion.
- [ ] Validar click en turno abre modal de edicion.
- [ ] Validar click en dia abre cobertura/Gantt.
- [ ] Confirmar exportacion de calendario por sucursal.
- [ ] Decidir si exportacion de grupo multi-hoja es bloqueante o queda fuera del go-live final.

## Fase 2: Matriz funcional real

- [ ] Crear usuarios de prueba: admin, supervisor sucursal unica, supervisor grupo, supervisor sin sucursal.
- [ ] Probar login admin.
- [ ] Probar login supervisor sucursal unica.
- [ ] Probar login supervisor grupo.
- [ ] Probar supervisor sin sucursales asignadas.
- [ ] Probar acceso bloqueado a sucursal no asignada.
- [ ] Probar generar calendario nuevo.
- [ ] Probar regenerar calendario existente.
- [ ] Probar guardar calendario completo.
- [ ] Probar guardar version incompleta.
- [ ] Probar cambiar vendedor desde modal.
- [ ] Probar editar horario de turno.
- [ ] Probar cobertura/Gantt de un dia.
- [ ] Probar historial `Ver calendario` para calendario admin.
- [ ] Probar historial `Ver calendario` para calendario supervisor/grupo.
- [ ] Probar exportacion de sucursal.

## Fase 3: Tests automaticos minimos

- [x] Agregar test unitario para split/merge de grupos por equipo. (src/lib/calendar/teamSplit.test.ts)
- [x] Agregar test unitario para fallback de categoria en calendarios de grupo. (src/lib/calendar/categoryFallback.test.ts)
- [x] Agregar smoke test de API `/api/calendars`. (src/app/api/calendars/route.test.ts)
- [x] Agregar smoke test de permisos supervisor. (src/middleware.test.ts)
- [x] Agregar smoke test de historial linkeando calendario real. (src/lib/audit/historial.test.ts)
- [x] Documentar que casos quedan solo como manuales y por que. (ver functional-test-matrix.md — flujos UI/modal/Gantt no son automatizables sin E2E)

## Fase 4: Datos maestros

- [x] Generar reporte de supervisores sin email. (GET /api/admin/data-health)
- [x] Generar reporte de supervisores sin password. (GET /api/admin/data-health)
- [x] Generar reporte de supervisores sin sucursales. (GET /api/admin/data-health)
- [x] Generar reporte de sucursales sin equipo. (GET /api/admin/data-health)
- [x] Generar reporte de equipos sin categoria. (GET /api/admin/data-health)
- [x] Generar reporte de equipos sin vendedores activos. (GET /api/admin/data-health)
- [x] Generar reporte de grupos con categorias inconsistentes. (GET /api/admin/data-health)
- [ ] Definir quien corrige cada dato: admin, RRHH o tecnico.
- [ ] Validar datos de jefes piloto antes de abrir uso final.

## Fase 5: Backup, restore y rollback

- [x] Documentar ubicacion real de la base SQLite en servidor. (pompeyo:/data/v4.db en v4-frontend-1)
- [x] Crear comando de backup manual con timestamp. (backup-rollback-runbook.md)
- [ ] Probar backup antes de deploy.
- [ ] Probar restore en ambiente controlado o registrar bloqueo.
- [x] Documentar rollback por git commit. (backup-rollback-runbook.md — git revert + push)
- [x] Documentar rollback por Docker. (backup-rollback-runbook.md — retag imagen SHA)
- [x] Registrar commit estable candidato a produccion. (tag v4-stable-20260505)
- [ ] Definir ventana de deploy y responsable de rollback.

## Fase 6: Mensajes y soporte

- [x] Agregar mensaje o ayuda visible para reportar problemas. (/supervisor/ayuda — seccion "Necesitas ayuda adicional" con formato y contacto)
- [x] Definir formato de reporte: usuario, sucursal, mes, accion, captura. (/supervisor/ayuda — texto explicito)
- [x] Definir correo/persona de soporte primera semana. (danilo.prieto@pompeyo.cl en /supervisor/ayuda)
- [x] Revisar mensajes de error mas comunes y traducirlos a lenguaje usuario. (F6 implemento mensajes legibles para todos los errores criticos)
- [x] Confirmar que errores de API no exponen stack trace al usuario. (verificado: catch blocks usan mensajes fijos, no err.message/stack)

## Fase 7: Observabilidad basica

- [x] Documentar comandos para revisar logs del contenedor. (observabilidad.md)
- [x] Documentar comandos para confirmar estado Docker. (observabilidad.md)
- [x] Documentar comandos para confirmar commit desplegado. (observabilidad.md)
- [x] Revisar si historial cubre generacion, guardado, exportacion y errores relevantes. (si — ver tabla en observabilidad.md)
- [x] Definir que alerta manual revisar durante primera semana. (observabilidad.md — 3 checks diarios)

## Fase 8: Ensayo go-live

- [ ] Ejecutar checklist funcional completo con un jefe piloto.
- [ ] Registrar fecha, usuario, sucursal/grupo y resultado.
- [ ] Registrar bugs o fricciones encontradas.
- [ ] Corregir bugs bloqueantes antes de go-live.
- [ ] Repetir prueba despues de correcciones.

## Fase 9: Decision final

- [ ] Completar `release-readiness.md`.
- [ ] Clasificar pendientes: bloqueante, importante, post go-live.
- [ ] Registrar version/commit desplegado.
- [ ] Registrar decision: piloto, produccion parcial o produccion final.
- [ ] Registrar responsable de seguimiento.
