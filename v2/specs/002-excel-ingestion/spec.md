# Spec 002 — Ingesta del Excel de Dotación (v2)

## Contexto

Igual que en v1, el admin sube un Excel con la dotación. Las diferencias clave respecto a v1:

1. **Nueva columna**: `Área de Negocio` (valores: `Ventas` | `Postventa`) → determina qué turnos aplican al trabajador.
2. **Clasificación automática**: en vez de pedir al admin que elija el tipo de sucursal, el parser busca el `codigo_area` en `area_catalog` (spec 001) y asigna `tipo_franja` solo.
3. **Fallback manual**: si el código no está en `area_catalog`, el admin puede clasificarla manualmente (igual que v1), y opcionalmente agregarla al catálogo.

## Campos del Excel que usamos

| Columna Excel | Atributo interno | Notas |
|---------------|-----------------|-------|
| `Rut` | `workers.rut` | Normalizar a `XXXXXXXX-X` |
| `Nombre` | `workers.nombre_completo` | |
| `Área` | `branches.codigo_area` + `branches.nombre` | Parsear dígitos iniciales como código |
| `Área de Negocio` | `workers.area_negocio` | `ventas` \| `postventa` (lowercase) |
| `Supervisor` | `workers.supervisor_nombre` | Opcional |

## Flujo de sincronización

1. Cargar Excel en el navegador, parsear con SheetJS.
2. Validar filas: RUT válido, Área parseable, Área de Negocio presente.
3. Para cada sucursal detectada:
   - Buscar `codigo_area` en `area_catalog`.
   - Si existe → asignar `tipo_franja` y `clasificacion` automáticamente. Sin intervención del admin.
   - Si no existe → mostrar alerta: pedir al admin que clasifique y si quiere agregarla al catálogo.
4. Preview: tabla con columnas RUT, Nombre, Área de Negocio, Sucursal, Clasificación, Estado.
5. Al confirmar:
   - Upsert `branches` (con `tipo_franja` y `clasificacion`).
   - Upsert `workers` (con `area_negocio` + `rotation_group` derivado de clasificación × área de negocio).
   - Soft-delete de workers que ya no están en el Excel.
   - Log en `audit_log`.

## Reglas de parseo

- **RUT**: igual que v1.
- **Área**: `"1200 Local Nissan Irarrazaval 965"` → `codigo_area = "1200"`, `nombre = "Local Nissan..."`
- **Área de Negocio**: normalizar a lowercase, aceptar `"Ventas"`, `"ventas"`, `"VENTAS"` → `"ventas"`.

## Colección modificada: `workers` (nuevos campos)

| Atributo nuevo | Tipo | Notas |
|----------------|------|-------|
| `area_negocio` | enum | `ventas` \| `postventa` |
| `rotation_group` | string | ID del grupo de rotación calculado (ej: `"V_M7"`, `"P_SA"`) |

## Criterios de aceptación

- [ ] El parser detecta y usa la columna `Área de Negocio`.
- [ ] Sucursales con `codigo_area` en el catálogo se clasifican automáticamente (sin modal de selección).
- [ ] Sucursales desconocidas muestran alerta y permiten clasificación manual.
- [ ] El campo `area_negocio` se guarda correctamente en el worker.
- [ ] El campo `rotation_group` se deriva automáticamente de `clasificacion × area_negocio`.
- [ ] Preview muestra la columna `Área de Negocio` y `Clasificación` para revisión del admin.
- [ ] Todo lo demás igual que v1 (idempotente, soft-delete, audit_log).
