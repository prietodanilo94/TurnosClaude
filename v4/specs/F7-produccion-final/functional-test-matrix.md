# F7 - Matriz de pruebas funcionales

Usar esta matriz para validar produccion final con datos reales. Cada prueba debe registrar fecha, usuario, sucursal/grupo, resultado y evidencia si falla.

## Formato

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|

## Acceso

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|
| F7-A01 | Login admin | Admin | Admin real | Entra a `/admin` | Pendiente | |
| F7-A02 | Login supervisor sucursal unica | Supervisor | 1 sucursal asignada | Entra a `/supervisor` y ve solo su sucursal | Pendiente | |
| F7-A03 | Login supervisor grupo | Supervisor | 2+ sucursales asignadas agrupadas | Ve grupo y sucursales permitidas | Pendiente | |
| F7-A04 | Supervisor sin sucursales | Supervisor | Sin asignaciones | Ve mensaje claro, sin error tecnico | Pendiente | |
| F7-A05 | Acceso no permitido | Supervisor | URL de sucursal ajena | App bloquea o redirige sin mostrar datos | Pendiente | |

## Calendario

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|
| F7-C01 | Abrir calendario admin | Admin | Sucursal con categoria | Calendario abre con tabs y colores | Pendiente | |
| F7-C02 | Abrir calendario supervisor individual | Supervisor | Sucursal individual | Misma experiencia visual que admin | Pendiente | |
| F7-C03 | Abrir calendario supervisor grupo | Supervisor | Grupo real | Calendario combinado abre por area | Pendiente | |
| F7-C04 | Historial abre calendario admin | Admin | Log `calendar.generate` admin | Link abre calendario correcto | Pendiente | |
| F7-C05 | Historial abre calendario supervisor/grupo | Admin | Log `calendar.generate` supervisor | Link abre calendario sin 404 ni categoria faltante falsa | Pendiente | |
| F7-C06 | Click vendedor | Admin/Supervisor | Slot visible | Modal permite asignar/cambiar vendedor | Pendiente | |
| F7-C07 | Click turno | Admin/Supervisor | Turno visible | Modal permite editar horario | Pendiente | |
| F7-C08 | Click dia/cobertura | Admin/Supervisor | Dia con turnos | Gantt/cobertura muestra turnos del dia | Pendiente | |

## Guardado y generacion

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|
| F7-G01 | Generar calendario nuevo | Admin/Supervisor | Mes sin calendario | Genera slots, auto-asigna si aplica, permite guardar | Pendiente | |
| F7-G02 | Regenerar calendario existente | Admin/Supervisor | Mes con calendario | Pide confirmacion y actualiza calendario | Pendiente | |
| F7-G03 | Guardar completo | Admin/Supervisor | Sin errores | Guarda y muestra mensaje exitoso | Pendiente | |
| F7-G04 | Guardar incompleto | Supervisor | Vendedores faltantes | Muestra confirmacion y permite guardar como incompleto | Pendiente | |
| F7-G05 | Cancelar guardado incompleto | Supervisor | Vendedores faltantes | No guarda y muestra mensaje cancelado | Pendiente | |

## Exportacion

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|
| F7-E01 | Exportar sucursal | Admin | Calendario guardado | Descarga Excel con nombre claro | Pendiente | |
| F7-E02 | Exportar RRHH | Admin | Calendario con asignaciones | Descarga formato RRHH o mensaje claro | Pendiente | |
| F7-E03 | Exportar grupo | Admin/Supervisor | Grupo real | Multi-hoja funciona o queda bloqueado con mensaje claro | Pendiente | |

## Historial y trazabilidad

| ID | Flujo | Rol | Datos | Resultado esperado | Estado | Notas |
|----|-------|-----|-------|--------------------|--------|-------|
| F7-H01 | Registrar generacion | Admin/Supervisor | Generar calendario | Historial muestra usuario, sucursal, mes, accion | Pendiente | |
| F7-H02 | Registrar guardado | Admin/Supervisor | Guardar cambios | Historial muestra cambio y link | Pendiente | |
| F7-H03 | Registrar exportacion | Admin | Exportar calendario | Historial registra exportacion | Pendiente | |
| F7-H04 | Filtros historial | Admin | Filtro por supervisor/sucursal/accion | Resultados coherentes | Pendiente | |
