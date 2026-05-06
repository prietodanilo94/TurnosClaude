# F6 - Tasks

## Fase 1: Preparacion de usuarios y permisos

- [x] Auditar jefes/supervisores sin email o password.
- [x] Agregar indicador en admin para credenciales incompletas.
- [x] Confirmar que cada jefe/supervisor ve solo sus sucursales asignadas.
- [x] Agregar mensaje claro para usuario sin sucursales asignadas.
- [x] Agregar bloqueo explicito si un usuario intenta abrir una sucursal no permitida.

## Fase 2: Home de jefatura/supervisor

- [x] Mostrar estado de cada sucursal o grupo: no generado, guardado, requiere revision.
- [x] Mostrar mes actual por defecto.
- [x] Agregar accion principal por card: "Ver calendario", "Generar", "Completar datos".
- [x] Mostrar alerta si una sucursal no tiene categoria.
- [x] Mostrar alerta si una sucursal no tiene vendedores/equipo configurado.
- [x] Mantener grupos e individuales separados visualmente.

## Fase 3: Calendario unico y consistente

- [x] Reutilizar `CalendarView` del admin en supervisor.
- [x] Agregar contrato documentado para props compartidos de `CalendarView`.
- [x] Evitar nuevas tablas calendario paralelas sin aprobacion explicita.
- [x] Agregar smoke visual/manual para tabs: mensual, vendedor, cobertura dia.
- [ ] Validar que click en vendedor abre modal de asignacion.
- [ ] Validar que click en turno abre modal de edicion.
- [ ] Validar que click en dia abre cobertura/Gantt.

## Fase 4: Validaciones antes de guardar

- [x] Crear helper `validateCalendarForPublish()`.
- [x] Validar sucursal sin categoria.
- [x] Validar vendedores sin asignar.
- [x] Validar turnos sin vendedor asignado.
- [x] Validar vendedor con turno en dia bloqueado.
- [x] Validar exceso de horas semanales segun regla vigente.
- [x] Validar cobertura diaria insuficiente.
- [x] Separar resultados en errores bloqueantes y advertencias.
- [x] Mostrar revision del calendario solo al intentar guardar, sin aviso permanente.
- [x] Confirmar guardado como version incompleta si hay errores bloqueantes.
- [x] Permitir guardado con advertencias, dejando registro en historial.

## Fase 5: Mensajes y confirmaciones

- [x] Estandarizar estados: sin guardar, guardando, guardado, error, requiere revision.
- [x] Mejorar mensaje al generar calendario por primera vez.
- [x] Mejorar mensaje al regenerar calendario existente.
- [x] Mostrar confirmacion con alcance: sucursal individual o grupo.
- [x] Mostrar mensaje final despues de guardar con nombre de sucursal/grupo.
- [x] Mostrar errores de API en lenguaje de usuario.

## Fase 6: Exportacion lista para jefaturas

- [x] Confirmar exportacion de calendario por sucursal.
- [x] Implementar exportacion de grupo como Excel multi-hoja.
- [x] Ocultar o deshabilitar botones de exportacion no implementados.
- [x] Agregar mensaje si se intenta exportar calendario con errores bloqueantes.
- [x] Validar nombre de archivo con sucursal/grupo, mes y anio.

## Fase 7: Ayuda dentro de la app

- [x] Agregar texto breve de ayuda en home supervisor.
- [x] Agregar ayuda breve en calendario: generar, guardar, editar, cobertura.
- [x] Agregar tooltip o texto preventivo para "Regenerar".
- [x] Crear modal/pagina "Como usar el calendario".
- [x] Agregar contacto o instruccion de soporte ante errores.

## Fase 8: Historial y trazabilidad

- [x] Registrar generacion de calendario desde supervisor.
- [x] Registrar guardado de calendario desde supervisor.
- [x] Registrar regeneracion de calendario.
- [x] Registrar exportacion.
- [x] Registrar validaciones bloqueantes al intentar guardar.
- [x] Mostrar en historial si el cambio afecto sucursal individual o grupo.

## Fase 9: Pruebas minimas

- [x] Agregar tests unitarios para generacion de calendario.
- [x] Agregar tests unitarios para split/merge de grupos por equipo.
- [x] Agregar tests unitarios para validaciones de calendario.
- [x] Agregar smoke test de API `/api/calendars`.
- [x] Agregar smoke test de acceso supervisor sin permisos.
- [x] Agregar checklist manual en `v4/specs/F6-produccion-jefes-sucursal/go-live-checklist.md`.

## Fase 10: Go-live controlado

- [ ] Crear lista piloto de 2-3 jefes de sucursal.
- [ ] Cargar/confirmar credenciales piloto.
- [ ] Probar flujo completo con datos reales de un mes.
- [ ] Recoger feedback de lenguaje, no solo bugs.
- [ ] Corregir fricciones antes de abrir a mas jefaturas.
- [ ] Definir responsable de soporte durante primera semana.
- [x] Definir procedimiento de rollback si el calendario queda inconsistente.

## Fase 11: Registro de cambios y reversibilidad

- [x] Crear `implementation-log.md` para documentar cambios F6 por entrega.
- [x] Registrar cada nueva entrega F6 con archivos tocados, verificacion y reversion sugerida.
- [x] Antes de deploy, confirmar que el log refleja el ultimo bloque implementado.
