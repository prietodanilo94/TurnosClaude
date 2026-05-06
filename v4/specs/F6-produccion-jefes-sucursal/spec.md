# F6 - Preparacion para produccion con jefes de sucursal

## Objetivo

Dejar Shift Planner listo para que jefes de sucursal y supervisores lo usen en operacion real sin depender de acompanamiento tecnico diario.

La app se considera lista para este grupo cuando una jefatura puede:

1. Entrar con sus credenciales.
2. Ver solo sus sucursales o grupos asignados.
3. Generar o revisar el calendario mensual.
4. Hacer ajustes manuales con confianza.
5. Guardar y exportar sin perder informacion.
6. Entender los avisos de la app sin pedir ayuda tecnica.
7. Reportar problemas con suficiente contexto para resolverlos rapido.

## Problema

La app ya resuelve el problema central de generar y editar turnos, pero todavia esta en etapa sensible para uso masivo:

- Hay flujos potentes, pero algunos mensajes no explican bien que ocurrio.
- Algunas pantallas criticas pueden divergir si se duplican componentes.
- Faltan validaciones preventivas antes de guardar calendarios.
- No existe una guia corta dentro del producto para usuarios nuevos.
- No hay una lista formal de pruebas post-deploy orientada al negocio.
- Los jefes de sucursal necesitan confianza, no solo funcionalidad.

## Principios de produccion

### 1. Una sola experiencia de calendario

Admin y supervisor deben compartir el mismo calendario base. Las diferencias por rol deben ser configuracion o pequenos wrappers, no componentes duplicados.

Ejemplo correcto:
- Admin usa `CalendarView`.
- Supervisor usa `CalendarView` con guardado/generacion adaptado a sus sucursales o grupos.

Ejemplo incorrecto:
- Crear una tabla distinta para supervisor que pierda pestanas, Gantt, colores, click en turno o edicion manual.

### 2. La app debe explicar sus decisiones

Todo flujo importante debe mostrar estados claros:

- "Sin guardar"
- "Cambios pendientes"
- "Guardado"
- "Faltan vendedores por asignar"
- "No se puede guardar porque hay turnos en dias bloqueados"
- "Calendario generado para 3 sucursales"

El usuario no debe tener que adivinar si algo funciono.

### 3. Validar antes de guardar

Antes de guardar un calendario, la app debe revisar problemas comunes y mostrarlos en lenguaje simple.

Validaciones minimas:
- Vendedores sin asignar.
- Turnos sin vendedor.
- Vendedor asignado en dia bloqueado.
- Exceso de horas semanales segun reglas definidas.
- Dia con cobertura insuficiente.
- Sucursal sin categoria.
- Grupo con sucursales sin equipos configurados.

Las validaciones deben diferenciar:
- Bloqueante: no se puede guardar.
- Advertencia: se puede guardar, pero la app avisa.

### 4. El rol jefe de sucursal debe ser simple

Para una jefatura, la pantalla principal debe responder tres preguntas:

- Que sucursales o grupos tengo?
- Que calendario debo revisar este mes?
- Que accion falta para dejarlo listo?

El flujo ideal es:

1. Login.
2. Seleccion de sucursal o grupo.
3. Calendario mensual.
4. Revision de cobertura.
5. Ajustes.
6. Guardar.
7. Exportar o compartir.

### 5. Todo cambio importante debe quedar trazado

La app debe permitir responder:

- Quien genero el calendario?
- Quien lo modifico?
- Cuando se guardo?
- Que sucursal o grupo fue afectado?
- Hubo errores al guardar o exportar?

F4 ya cubre historial. F6 exige que los flujos de produccion lo usen de forma consistente.

## Alcance funcional

### Login y acceso

- Cada jefe de sucursal/supervisor debe tener credenciales reales.
- Si no tiene sucursales asignadas, debe ver un mensaje claro.
- Si intenta entrar a una sucursal no asignada, debe recibir bloqueo por permisos.
- El admin debe poder revisar rapidamente quienes tienen credenciales incompletas.

### Home supervisor/jefe

La home debe mostrar:

- Grupos existentes.
- Sucursales individuales.
- Mes actual por defecto.
- Estado del calendario: no generado, con cambios pendientes, guardado, o requiere revision.
- Accion principal clara: "Ver calendario", "Generar calendario", "Completar datos".

### Calendario

Debe mantener la experiencia completa:

- Pestana calendario mensual.
- Pestana turno por vendedor.
- Pestana cobertura del dia / Gantt.
- Colores por vendedor.
- Click en vendedor para asignar/cambiar.
- Click en turno para editar horario.
- Click en dia para ver cobertura.
- Guardar cambios.
- Generar/regenerar con confirmacion clara.

### Validaciones de calendario

La pantalla debe mostrar un panel de revision antes o despues de guardar:

- "Listo para publicar"
- "Requiere revision"
- "No se puede guardar"

Cada problema debe incluir:

- Que ocurre.
- Donde ocurre.
- Como corregirlo.

Ejemplo:

> "Vendedor Juan Perez tiene turno el 12 de mayo, pero esta bloqueado por licencia. Cambia el vendedor o elimina el turno."

### Exportacion

El usuario debe poder exportar:

- Calendario por sucursal.
- Calendario por grupo, idealmente Excel multi-hoja.
- Vista para RRHH si aplica.

Si la exportacion de grupos no esta lista, debe mostrarse como pendiente y no como boton roto.

### Ayuda dentro de la app

Agregar ayuda simple, no un manual eterno:

- Texto corto en cada pantalla critica.
- Tooltips para acciones peligrosas.
- Confirmaciones claras para regenerar o sobrescribir.
- Una pagina o modal "Como usar el calendario".

### Checklist post-deploy

Despues de cada despliegue, se debe ejecutar una prueba corta:

- Dominio responde.
- Login funciona.
- Supervisor ve sus sucursales.
- Calendario admin abre.
- Calendario supervisor abre.
- Generar calendario funciona en una sucursal de prueba.
- Guardar calendario funciona.
- Exportar funciona o muestra pendiente controlado.

## Fuera de alcance inicial

- Aplicacion movil nativa.
- Aprobaciones multi-nivel complejas.
- Firma electronica.
- Integracion directa con reloj control.
- Motor legal laboral completo si no existen reglas confirmadas por RRHH.

## Criterios de aceptacion

- Un jefe de sucursal puede completar el flujo mensual sin ayuda tecnica.
- Admin y supervisor usan el mismo calendario base.
- No hay botones visibles que terminen en errores no controlados.
- Las validaciones principales aparecen en lenguaje simple.
- El sistema bloquea accesos fuera de permiso.
- El despliegue en `turnos4.dpmake.cl` tiene checklist repetible.
- Los cambios importantes quedan en historial.
- La app puede ser demostrada a jefaturas con datos reales y bajo riesgo.

