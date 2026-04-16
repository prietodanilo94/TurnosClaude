# Spec 002 — Ingesta del Excel de Dotación

## Contexto

El admin sube un Excel con la dotación activa. El sistema debe parsearlo, validarlo, permitir preview, y sincronizar contra las colecciones `workers` y `branches` sin duplicar ni perder datos históricos.

## Objetivo

Permitir al admin:
1. Subir un Excel `.xlsx` desde la UI.
2. Ver un preview con los trabajadores detectados y las sucursales nuevas/existentes.
3. Confirmar la sincronización.
4. Obtener un reporte de qué se creó, actualizó y desactivó.

## Campos del Excel que usamos

| Columna Excel                  | Atributo interno               |
|--------------------------------|--------------------------------|
| `Rut`                          | `workers.rut`                  |
| `Nombre`                       | `workers.nombre_completo`      |
| `Área`                         | `branches.codigo_area` + `branches.nombre` (parseamos los 3-4 dígitos iniciales como código y el resto como nombre) |
| `Supervisor`                   | `workers.supervisor_nombre`    |

El resto de columnas se ignoran.

## Reglas de parseo

- **RUT**: limpiar espacios, normalizar a formato `XXXXXXXX-X` (mayúscula en DV si es K).
- **Área**: ejemplo `"1200 Local Nissan Irarrazaval 965"` → `codigo_area = "1200"`, `nombre = "Local Nissan Irarrazaval 965"`.
- Si `Área` no tiene código numérico al inicio → fila inválida, reportar al usuario.
- Filas con RUT vacío → ignorar.

## Flujo de sincronización

1. Cargar Excel al navegador y parsear con SheetJS.
2. Validar filas (RUT válido, área parseable).
3. Agrupar por `codigo_area` y mostrar al admin:
   - Sucursales nuevas (no existen en `branches`): pedir al admin que asigne `tipo_franja` antes de continuar.
   - Sucursales existentes: mostrar cantidad de trabajadores detectados.
4. Al confirmar:
   - Upsert de `branches` (solo si hay nuevas).
   - Upsert de `workers` por RUT:
     - Si existe y estaba activo: actualizar datos y `ultima_sync_excel`.
     - Si existe y estaba desactivado: reactivar.
     - Si no existe: crear.
   - Soft-delete de `workers` que existían antes pero no están en el Excel → `activo = false`.
5. Log en `audit_log` con metadata: total filas, creados, actualizados, desactivados.

## Criterios de aceptación

- [ ] Subir un Excel con 100+ filas parsea en < 3 segundos en el navegador.
- [ ] Detecta sucursales nuevas y pide tipo antes de guardar.
- [ ] Preview muestra filas inválidas con razón clara.
- [ ] La operación de sincronización es atómica a nivel percibido (UI muestra progress; si falla mitad, hay rollback parcial via audit_log).
- [ ] Reporte post-sync con contadores.
- [ ] Trabajadores removidos del Excel quedan marcados `activo = false`, NO borrados.

## UI

- Ruta: `/admin/dotacion`.
- Drop zone para `.xlsx`.
- Tabla preview con columnas: RUT, Nombre, Sucursal, Estado (nuevo/existente/inválido).
- Panel lateral con resumen por sucursal.
- Botón "Confirmar sincronización" deshabilitado hasta que todas las sucursales nuevas tengan `tipo_franja`.
