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

- [ ] Agregar test unitario para split/merge de grupos por equipo.
- [ ] Agregar test unitario para fallback de categoria en calendarios de grupo.
- [ ] Agregar smoke test de API `/api/calendars`.
- [ ] Agregar smoke test de permisos supervisor.
- [ ] Agregar smoke test de historial linkeando calendario real.
- [ ] Documentar que casos quedan solo como manuales y por que.

## Fase 4: Datos maestros

- [ ] Generar reporte de supervisores sin email.
- [ ] Generar reporte de supervisores sin password.
- [ ] Generar reporte de supervisores sin sucursales.
- [ ] Generar reporte de sucursales sin equipo.
- [ ] Generar reporte de equipos sin categoria.
- [ ] Generar reporte de equipos sin vendedores activos.
- [ ] Generar reporte de grupos con categorias inconsistentes.
- [ ] Definir quien corrige cada dato: admin, RRHH o tecnico.
- [ ] Validar datos de jefes piloto antes de abrir uso final.

## Fase 5: Backup, restore y rollback

- [ ] Documentar ubicacion real de la base SQLite en servidor.
- [ ] Crear comando de backup manual con timestamp.
- [ ] Probar backup antes de deploy.
- [ ] Probar restore en ambiente controlado o registrar bloqueo.
- [ ] Documentar rollback por git commit.
- [ ] Documentar rollback por Docker.
- [ ] Registrar commit estable candidato a produccion.
- [ ] Definir ventana de deploy y responsable de rollback.

## Fase 6: Mensajes y soporte

- [ ] Agregar mensaje o ayuda visible para reportar problemas.
- [ ] Definir formato de reporte: usuario, sucursal, mes, accion, captura.
- [ ] Definir correo/persona de soporte primera semana.
- [ ] Revisar mensajes de error mas comunes y traducirlos a lenguaje usuario.
- [ ] Confirmar que errores de API no exponen stack trace al usuario.

## Fase 7: Observabilidad basica

- [ ] Documentar comandos para revisar logs del contenedor.
- [ ] Documentar comandos para confirmar estado Docker.
- [ ] Documentar comandos para confirmar commit desplegado.
- [ ] Revisar si historial cubre generacion, guardado, exportacion y errores relevantes.
- [ ] Definir que alerta manual revisar durante primera semana.

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
