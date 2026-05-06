# F7 - Produccion final sin acompanamiento

## Objetivo

Convertir el piloto controlado de F6 en una version apta para uso operativo recurrente por jefes de sucursal, supervisores y administradores, sin que cada calendario requiera apoyo tecnico cercano.

La version se considera lista para produccion final cuando:

1. Los flujos criticos fueron probados con datos reales.
2. Los errores esperables aparecen como mensajes claros, no como pantallas rotas.
3. El equipo puede respaldar y restaurar la base antes de cambios importantes.
4. Los permisos impiden ver o modificar sucursales ajenas.
5. El historial permite reconstruir que paso y quien lo hizo.
6. Existe una forma simple de reportar, diagnosticar y revertir problemas.

## Estado de partida

F6 deja la app preparada para piloto con jefes de sucursal. Aun no basta para produccion final porque faltan pruebas funcionales sistematicas, cobertura de datos maestros, respaldo/restore, exportacion de grupos, monitoreo basico y criterios formales de aceptacion.

## Principios

### 1. Produccion es confianza, no solo features

Una pantalla que funciona una vez no basta. Produccion exige que el usuario sepa que hacer cuando:

- Falta una categoria.
- Falta un vendedor.
- Un calendario fue guardado incompleto.
- Una sucursal pertenece a un grupo.
- Una exportacion no esta disponible.
- Un permiso bloquea acceso.

### 2. Cada flujo critico debe tener prueba real

No se acepta como listo un cambio probado solo con build. Para produccion final, cada flujo critico debe tener al menos:

- Prueba manual documentada con resultado.
- Test unitario o smoke donde sea razonable.
- Evidencia de deploy y URL/ruta probada.

### 3. Los datos maestros son parte del producto

El sistema depende de categorias, equipos, vendedores, supervisores y grupos. Si esos datos estan incompletos, la app debe avisar claramente y el admin debe poder corregirlos sin tocar base de datos.

### 4. Debe existir salida segura

Antes de abrir a mas usuarios, debe existir:

- Backup de SQLite.
- Procedimiento de restore probado.
- Commit desplegado registrado.
- Plan de rollback por git/docker.
- Contacto responsable durante la primera semana.

## Alcance

### QA funcional

Probar con datos reales:

- Login admin.
- Login supervisor con sucursal unica.
- Login supervisor con grupo.
- Supervisor sin sucursales.
- Admin historial.
- Generar calendario.
- Regenerar calendario.
- Guardar version completa.
- Guardar version incompleta.
- Editar turno.
- Cambiar vendedor.
- Ver cobertura/Gantt.
- Exportar calendario por sucursal.
- Bloqueo por permisos.

### Datos maestros

Auditar y corregir:

- Supervisores sin email.
- Supervisores sin password.
- Supervisores sin sucursales.
- Sucursales sin equipos.
- Equipos sin categoria.
- Equipos sin vendedores activos.
- Grupos con categorias inconsistentes.
- Calendarios existentes sin asignaciones.

### Respaldo y rollback

Definir procedimientos repetibles:

- Backup manual antes de deploy.
- Backup manual antes de sync masivo de dotacion.
- Restore validado en servidor.
- Rollback de commit.
- Rollback de contenedor.
- Registro de version desplegada.

### Observabilidad y soporte

Agregar o documentar:

- Logs a revisar.
- Errores conocidos.
- Mensaje de soporte para usuarios.
- Formato minimo de reporte: usuario, sucursal, mes, accion, captura.
- Responsable de primera respuesta.

### Exportacion

Cerrar brecha de exportacion:

- Export sucursal probado.
- Export grupo multi-hoja implementado o explicitamente fuera de go-live final.
- Botones no disponibles ocultos o deshabilitados con mensaje claro.

## Fuera de alcance

- App movil nativa.
- Integracion con reloj control.
- Motor legal laboral completo no validado por RRHH.
- Firma/aprobacion formal multi-nivel.
- Automatizacion completa de soporte.

## Criterios de aceptacion

- No hay rutas criticas que terminen en 404, 500 o mensaje tecnico sin explicacion.
- Las rutas criticas tienen checklist manual ejecutado y fechado.
- Los tests automaticos existentes pasan antes de deploy.
- Hay al menos un smoke funcional contra `turnos4.dpmake.cl` para un caso real.
- Existe backup reciente antes de abrir uso masivo.
- Restore fue probado al menos una vez o queda documentado como bloqueo de produccion final.
- Los jefes piloto pueden generar, ajustar, guardar y revisar calendario sin ayuda tecnica.
- Admin puede diagnosticar desde historial que calendario se genero, guardo o exporto.
- La decision final de go-live queda registrada en `release-readiness.md`.
