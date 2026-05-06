# F6 - Smoke manual del calendario

Usar este checklist despues de cambios en `CalendarView` o en el flujo supervisor.

## Datos de prueba

- Ambiente:
- Commit:
- Usuario admin:
- Usuario supervisor:
- Sucursal o grupo:
- Mes:

## Pruebas visuales y de interaccion

- [ ] Admin abre calendario mensual con colores vivos.
- [ ] Supervisor abre el mismo calendario base, no una tabla distinta.
- [ ] Pestana `Calendario Mensual` muestra semanas y filas por vendedor/slot.
- [ ] Pestana `Turno por Vendedor` carga sin romper.
- [ ] Pestana `Cobertura del Dia` carga Gantt/cobertura.
- [ ] Click en nombre de vendedor abre modal de asignacion.
- [ ] Cambiar vendedor deja boton `Guardar` activo.
- [ ] Click en turno abre modal de edicion de horario.
- [ ] Guardar horario modificado deja feedback claro.
- [ ] Click en dia desde calendario mensual abre o enfoca cobertura del dia.
- [ ] Guardar completo muestra mensaje con nombre de sucursal/grupo.
- [ ] Guardar incompleto pide confirmacion solo al apretar guardar.
- [ ] Exportar con errores muestra mensaje y no descarga archivo defectuoso.

## Resultado

- [ ] OK para piloto.
- [ ] Requiere correccion antes de piloto.

Notas:

-
