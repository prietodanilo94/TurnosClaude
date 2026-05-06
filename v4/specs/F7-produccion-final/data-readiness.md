# F7 - Preparacion de datos maestros

Produccion final depende de datos correctos. Esta lista evita que un problema de carga parezca bug de calendario.

## Reportes requeridos

### Supervisores

- [ ] Supervisores activos sin email.
- [ ] Supervisores activos sin password.
- [ ] Supervisores activos sin sucursales asignadas.
- [ ] Supervisores duplicados por nombre parecido.
- [ ] Supervisores con sucursales que no corresponden.

### Sucursales y equipos

- [ ] Sucursales sin equipo.
- [ ] Equipos sin categoria.
- [ ] Equipos sin vendedores activos.
- [ ] Equipos con menos vendedores que slots esperados.
- [ ] Sucursales que pertenecen a grupo incorrecto.
- [ ] Grupos con sucursales de areas/categorias inconsistentes.

### Vendedores

- [ ] Vendedores activos sin RUT valido.
- [ ] Vendedores duplicados.
- [ ] Vendedores en equipo incorrecto.
- [ ] Vendedores virtuales usados como reales.
- [ ] Vendedores bloqueados durante el mes piloto.

### Calendarios existentes

- [ ] Calendarios sin assignments.
- [ ] Calendarios guardados como incompletos.
- [ ] Calendarios de grupo divididos por equipo correctamente.
- [ ] Calendarios cuyo link en historial abre correctamente.

## Criterios de bloqueo

Bloquea produccion final:

- Supervisor piloto sin email/password.
- Supervisor piloto sin sucursal.
- Sucursal piloto sin equipo.
- Equipo piloto sin categoria y sin fallback de grupo.
- Equipo piloto sin vendedores activos.
- Historial con links rotos para calendarios piloto.
- No existe backup reciente de la base.

No bloquea produccion final si esta documentado:

- Supervisores no piloto sin credenciales.
- Sucursales no piloto sin categoria.
- Exportacion de grupo pendiente, siempre que el boton no prometa algo roto.
- Advertencias de calendario que permitan guardar version incompleta.

## Resultado esperado

Antes de go-live, completar una tabla simple:

| Area | Total revisado | OK | Pendiente no bloqueante | Bloqueante | Responsable |
|------|----------------|----|--------------------------|------------|-------------|
| Supervisores | | | | | |
| Sucursales/equipos | | | | | |
| Vendedores | | | | | |
| Calendarios | | | | | |
