# F6 - Go-live checklist

Usar este checklist antes de habilitar o demostrar `turnos4.dpmake.cl` a jefes de sucursal.

## Servidor

- [ ] `git -C /opt/shift-optimizer status --short --branch` limpio y en `origin/main`.
- [ ] `cd /opt/shift-optimizer/v4 && docker compose ps` muestra `v4-frontend-1` arriba.
- [ ] `https://turnos4.dpmake.cl/login` responde 200.
- [ ] `https://turnos4.dpmake.cl/supervisor` redirige a login si no hay sesion.
- [ ] Logs recientes sin errores criticos: `docker logs --tail 80 v4-frontend-1`.

## Datos

- [ ] Jefes/supervisores piloto tienen email y password.
- [ ] Jefes/supervisores piloto tienen sucursales asignadas.
- [ ] Sucursales piloto tienen categoria.
- [ ] Sucursales piloto tienen vendedores activos.
- [ ] Bloqueos vigentes fueron cargados o confirmados.

## Flujo admin

- [ ] Admin puede entrar.
- [ ] Admin puede ver sucursales.
- [ ] Admin puede abrir calendario de una sucursal.
- [ ] Admin puede generar/regenerar calendario.
- [ ] Admin puede editar un turno.
- [ ] Admin puede guardar.

## Flujo jefe/supervisor

- [ ] Jefe/supervisor puede entrar.
- [ ] Ve solo sus sucursales o grupos.
- [ ] Puede abrir calendario.
- [ ] Ve pestanas: calendario mensual, turno por vendedor, cobertura del dia.
- [ ] Puede asignar/cambiar vendedor.
- [ ] Puede editar turno.
- [ ] Puede guardar.
- [ ] Si no tiene permiso sobre una sucursal, el acceso se bloquea.

## Exportacion

- [ ] Exportar calendario por sucursal funciona.
- [ ] Exportar grupo funciona o el boton queda oculto/deshabilitado con mensaje claro.
- [ ] El archivo descargado tiene nombre entendible.

## Cierre

- [ ] Se registro el commit desplegado.
- [ ] Se definio quien recibe dudas durante la primera semana.
- [ ] Se explico a usuarios piloto que reportar: sucursal, mes, accion y captura.
- [ ] Existe plan de rollback si aparece un problema bloqueante.

