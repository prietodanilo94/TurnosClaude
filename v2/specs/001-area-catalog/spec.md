# Spec 001 — Catálogo de Áreas

## Contexto

En v1, cuando se sube un Excel con una sucursal nueva, el admin debe elegir manualmente su `tipo_franja`. En v2 eliminamos ese paso: el sistema conoce previamente las 63 áreas de la empresa y su clasificación.

## Objetivo

Crear una colección `area_catalog` en Appwrite (DB `main-v2`) con el mapeo completo:
- `codigo_area` → `clasificacion` → `tipo_franja` → `comuna`

Al subir el Excel, el parser busca el código en esta tabla y asigna la clasificación automáticamente, sin intervención del admin.

## Clasificaciones

| clasificacion | tipo_franja | Descripción |
|---------------|-------------|-------------|
| `standalone` | `standalone` | Local propio, L–V + Sáb medio día, Dom cerrado |
| `mall_sin_dom` | `movicenter` | Mall L–S o similar, Dom cerrado |
| `mall_7d` | `movicenter` | Mall abre 7 días incluyendo domingo |
| `mall_autopark` | `autopark` | Autopark (horario especial) |

## Catálogo completo (seed)

| codigo_area | nombre | clasificacion | comuna |
|-------------|--------|---------------|--------|
| 108 | Seminuevos Autoshopping | standalone | Autopark |
| 1106 | Seminuevos Bilbao | standalone | Bilbao |
| 103 | Seminuevos Gran Avenida | standalone | Gran Avenida |
| 107 | Seminuevos Movicenter | mall_7d | Movicenter |
| 1201 | Local Kia Gran Avenida | standalone | Gran Avenida |
| 101 | Seminuevos Irarrazaval 1330 | standalone | Irarrázaval |
| 1108 | Seminuevos Mall Plaza Oeste | mall_sin_dom | Oeste |
| 1200 | Local Nissan Irarrazaval 965 | standalone | Irarrázaval |
| 104 | Seminuevos Maipú | standalone | Maipú |
| 1221 | Local Kia Mall Plaza Tobalaba | mall_7d | Tobalaba |
| 130 | Local DFSK Mall Plaza Oeste | mall_sin_dom | Oeste |
| 1320 | Local Nissan Gran Avenida | standalone | Gran Avenida |
| 133 | Local Subaru Mall Plaza Vespucio | mall_7d | Vespucio |
| 1350 | Nissan Flota | standalone | Bilbao |
| 135 | Local Subaru Mall Plaza Oeste | mall_sin_dom | Oeste |
| 1211 | Local Kia Mall Plaza Oeste | mall_sin_dom | Oeste |
| 124 | Local Kia Mall Arauco Maipu | mall_7d | Arauco |
| 128 | Local Nissan Bilbao | standalone | Bilbao |
| 330 | Local Geely Bilbao | standalone | Bilbao |
| 1361 | Local Nissan Mall Plaza Sur | mall_7d | Sur |
| 1362 | Local Nissan Movicenter | mall_7d | Movicenter |
| 1410 | Local DFSK Mall Plaza Tobalaba | mall_7d | Tobalaba |
| 402 | Local Citroën Bilbao | standalone | Bilbao |
| 1413 | Local DFSK Mall Arauco Maipu | mall_7d | Arauco |
| 1412 | Local DFSK Gran Avenida | standalone | Gran Avenida |
| 143 | Local DFSK Mall Plaza Sur | mall_7d | Sur |
| 144 | Local Subaru Mall Plaza Sur | mall_7d | Sur |
| 145 | Local Subaru Mall Plaza Tobalaba | mall_7d | Tobalaba |
| 331 | Local Geely Gran Avenida | standalone | Gran Avenida |
| 511 | Local Landking Gran Avenida | standalone | Gran Avenida |
| 320 | Local MG Movicenter | mall_7d | Movicenter |
| 324 | Local MG Independencia | mall_sin_dom | Independencia |
| 321 | MG Virtual | standalone | Irarrázaval |
| 322 | Local MG Irarrázaval | standalone | Irarrázaval |
| 336 | Local Geely Irarrázaval | standalone | Irarrázaval |
| 360 | Local Opel Irarrazaval | standalone | Irarrázaval |
| 401 | Local Citroën Irarrázaval 965 | standalone | Irarrázaval |
| 134 | Local Kia Red Cube Maipu | standalone | Maipú |
| 332 | Local Geely Mall Plaza Oeste | mall_sin_dom | Oeste |
| 343 | Local Peugeot Camino Melipilla | standalone | Maipú |
| 344 | Virtual Peugeot | standalone | Maipú |
| 352 | Local Opel Camino Melipilla | standalone | Maipú |
| 337 | Local Geely Mall Arauco Maipu | mall_7d | Arauco |
| 340 | Local Peugeot Movicenter | mall_7d | Movicenter |
| 341 | Local Peugeot Mall Arauco Maipu | mall_7d | Arauco |
| 500 | Transportes Maipú | standalone | Maipú |
| 510 | Local Landking Maipú | standalone | Maipú |
| 345 | Local Peugeot Mall Plaza Sur | mall_7d | Sur |
| 1414 | Local DFSK Melipilla | standalone | Melipilla |
| 350 | Local Opel Movicenter | mall_7d | Movicenter |
| 351 | Local Opel Mall Plaza Egaña | mall_7d | Egaña |
| 151 | Local Kia Melipilla | standalone | Melipilla |
| 353 | Local Opel Mall Plaza Sur | mall_7d | Sur |
| 325 | Local MG Melipilla | standalone | Melipilla |
| 334 | Local Geely Melipilla | standalone | Melipilla |
| 153 | Local Kia Quilin | standalone | Quilín |
| 323 | Local MG Quilin | standalone | Quilín |
| 403 | Local Citroën Mall Plaza Sur | mall_7d | Sur |
| 404 | Local Citroën Movicenter | mall_7d | Movicenter |
| 335 | Local Geely Quilin | standalone | Quilín |
| 346 | Local Peugeot Quilín | standalone | Quilín |
| 400 | Local Citroën Quilín | standalone | Quilín |
| 550 | Leap Motor Movicenter | mall_7d | Movicenter |

## Colección Appwrite: `area_catalog`

| Atributo | Tipo | Req | Notas |
|----------|------|-----|-------|
| `$id` | string | sí | `codigo_area` como string (ej: `"108"`) |
| `nombre_display` | string | sí | Nombre completo del área |
| `clasificacion` | enum | sí | `standalone` \| `mall_sin_dom` \| `mall_7d` \| `mall_autopark` |
| `tipo_franja` | enum | sí | `standalone` \| `movicenter` \| `autopark` \| `sur` (compat. con motor) |
| `comuna` | string | sí | Referencia geográfica informativa |

**Índices**: `clasificacion`, `tipo_franja`.
**Permisos**: lectura todos · escritura admin.

## Criterios de aceptación

- [ ] Script `seed-area-catalog.ts` carga los 63 registros en DB `main-v2`, colección `area_catalog`.
- [ ] El script es idempotente (segunda ejecución no duplica registros).
- [ ] Tipos TypeScript `AreaCatalog` y Pydantic `AreaCatalog` creados.
- [ ] Función helper `lookupArea(codigoArea: string): AreaCatalog | null` disponible en frontend y backend.
