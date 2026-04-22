# Spec 008 — Edición de Clasificación de Sucursal

## Contexto

Aunque el sistema clasifica automáticamente las sucursales desde el catálogo de áreas (spec 001), puede haber errores de seed o cambios en la realidad del negocio (una sucursal que pasa de Stand Alone a Mall, por ejemplo). El admin necesita poder corregir esto sin tocar código.

## Feature

Un botón **"✏️ Cambiar clasificación"** en la ficha de cada sucursal dentro del admin panel.

## Flujo

1. Admin entra a `/admin/sucursales/[branchId]`.
2. Ve el campo "Clasificación": `Stand Alone` · `✏️ Cambiar`.
3. Hace clic en ✏️.
4. Se abre un modal/drawer con:
   - Selector de `clasificacion` (Stand Alone / Mall sin dom / Mall 7 días / Mall Autopark).
   - Campo de texto para `tipo_franja` (auto-rellenado al elegir clasificacion, editable).
   - Botón "Guardar".
5. Al guardar:
   - Actualiza `branches.clasificacion` y `branches.tipo_franja` en Appwrite.
   - Actualiza `area_catalog` si el usuario lo indica (checkbox "Actualizar catálogo para futuras importaciones").
   - Log en `audit_log`.
6. El cambio tiene efecto inmediato: la próxima generación de turnos para esa sucursal usará la nueva clasificación.

## Advertencia importante

Si ya hay propuestas generadas para esa sucursal en el mes actual, mostrar un aviso:

> ⚠️ Ya existen propuestas generadas para esta sucursal en el mes actual. Cambiar la clasificación no afecta las propuestas existentes — solo se aplicará a nuevas generaciones.

## Colección modificada: `branches` (nuevo campo)

| Atributo nuevo | Tipo | Notas |
|----------------|------|-------|
| `clasificacion` | enum | `standalone` \| `mall_sin_dom` \| `mall_7d` \| `mall_autopark` |

> El campo `tipo_franja` ya existe. `clasificacion` es nuevo y más granular.

## UI

- Ruta: `/admin/sucursales/[branchId]` — sección "Información de la sucursal".
- Modal de edición con `<Select>` de clasificación y field de tipo_franja.
- Botón deshabilitado hasta que haya cambios.
- Feedback de éxito/error con toast.

## Criterios de aceptación

- [ ] El botón de edición aparece en la ficha de sucursal para el admin.
- [ ] Al cambiar clasificación, `tipo_franja` se actualiza automáticamente al valor correcto.
- [ ] El admin puede overridear `tipo_franja` manualmente si necesita.
- [ ] El cambio persiste en Appwrite (`branches` y opcionalmente `area_catalog`).
- [ ] Se muestra advertencia si hay propuestas existentes para el mes.
- [ ] Solo admins pueden hacer este cambio (jefes no ven el botón).
- [ ] Log en `audit_log`.
