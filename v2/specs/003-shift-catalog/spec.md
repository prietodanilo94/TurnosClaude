# Spec 003 — Catálogo de Turnos v2

## Contexto

En v1 hay 10 turnos fijos globales. En v2 los turnos están organizados por **rotation_group** (clasificación de sucursal × área de negocio). Cada grupo define qué turnos están disponibles para el optimizer.

## Colección: `shift_catalog_v2`

| Atributo | Tipo | Req | Notas |
|----------|------|-----|-------|
| `$id` | string | sí | Ej: `V_SA_APE`, `V_M7_COM` |
| `nombre_display` | string | sí | Ej: `"Apertura Stand Alone"` |
| `rotation_group` | string | sí | Ej: `"V_SA"`, `"V_M7"`, `"P_SA"` |
| `nombre_turno` | string | sí | `"apertura"` \| `"cierre"` \| `"completo"` \| `"sabado"` \| `"unico"` |
| `horario_por_dia` | JSON | sí | `{ "lunes": {"inicio":"09:00","fin":"17:30"}, ... }` |
| `descuenta_colacion` | boolean | sí | `true` si duración ≥ 6h |
| `dias_aplicables` | string[] | sí | `["lunes","martes",...]` |

## Grupos de rotación y sus turnos

### `V_SA` — Ventas Stand Alone

| ID | nombre_turno | L–V | Sábado | Dom | H. lab. |
|----|-------------|-----|--------|-----|---------|
| `V_SA_APE` | apertura | L–J 09:00–18:30 / V 09:00–18:00 | — | — | 42h semanales |
| `V_SA_CIE` | cierre | 10:30–19:00 | — | — | 7.5h |
| `V_SA_SAB` | sabado | — | 10:00–14:30 | — | 4.5h |

> Semana tipo: 5 × 7.5h + 4.5h = 42h ✓

### `V_ML` — Ventas Mall sin domingo

| ID | nombre_turno | L–S | Dom | H. lab. |
|----|-------------|-----|-----|---------|
| `V_ML_APE` | apertura | 10:00–18:00 | — | 7h |
| `V_ML_CIE` | cierre | 12:00–20:00 | — | 7h |

### `V_AP` — Ventas Mall Autopark

| ID | nombre_turno | L–V | Sábado | Dom | H. lab. |
|----|-------------|-----|--------|-----|---------|
| `V_AP_APE` | turno_1 | M–V 09:30–19:00 | 10:00–19:00 | — | 42h |
| `V_AP_CIE` | turno_2 | L–M–X y V 09:30–19:00 | 10:00–19:00 | — | 42h |

> En Autopark se acepta que algunos turnos comiencen antes de la apertura formal de sucursal (`10:00`) y eso no se considera infraccion en este caso.

### `V_M7` — Ventas Mall 7 días (con domingo)

| ID | nombre_turno | L–D | H. lab. | Uso semanal |
|----|-------------|-----|---------|-------------|
| `V_M7_APE` | apertura | 10:00–19:00 | 8h | 1–3 días |
| `V_M7_CIE` | cierre | 11:00–20:00 | 8h | 1–3 días |
| `V_M7_COM` | completo | 10:00–20:00 | 9h | 2 días |

> Semana tipo: 3 × 8h + 2 × 9h = 42h ✓ · 5 días trabajados · 2 libres

### `P_SA` — Postventa Stand Alone

| ID | nombre_turno | L–J | Viernes | Sábado |
|----|-------------|-----|---------|--------|
| `P_SA_A` | opcion_a | 08:30–18:00 | 08:30–17:30 | — |
| `P_SA_B` | opcion_b | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### `P_MQ` — Postventa Mall Quilín / Movicenter

| ID | nombre_turno | L–J | Viernes | Sábado |
|----|-------------|-----|---------|--------|
| `P_MQ_A` | opcion_a | 08:30–18:00 | 08:30–17:30 | — |
| `P_MQ_B` | opcion_b | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### `P_MT` — Postventa Mall Tobalaba

| ID | nombre_turno | L–J | Viernes | Sábado |
|----|-------------|-----|---------|--------|
| `P_MT_A` | opcion_a | 08:30–18:00 | 08:30–17:30 | — |
| `P_MT_B` | opcion_b | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### `P_MO` — Postventa Mall Oeste

| ID | nombre_turno | L–J | Viernes | Sábado |
|----|-------------|-----|---------|--------|
| `P_MO_A` | opcion_a | 08:00–17:30 | 08:00–17:00 | — |
| `P_MO_B` | opcion_b | 08:00–16:30 | 08:00–16:00 | 09:00–14:00 |

### `P_CAP` — Postventa CAP

| ID | nombre_turno | L–J | Viernes | Sábado |
|----|-------------|-----|---------|--------|
| `P_CAP_A` | opcion_a | 08:30–18:00 | 08:30–17:30 | — |
| `P_CAP_B` | opcion_b | 08:30–17:00 | 08:30–16:30 | 09:00–14:00 |

### Turnos únicos

| ID | rotation_group | nombre_turno | L–J | Viernes |
|----|---------------|-------------|-----|---------|
| `U_BO` | `U_BO` | unico | 09:00–18:30 | 09:00–18:00 |
| `U_DP` | `U_DP` | unico | 08:30–18:00 | 08:30–17:30 |

## Mapeo rotation_group por sucursal

| clasificacion | area_negocio | rotation_group |
|---------------|-------------|----------------|
| `standalone` | `ventas` | `V_SA` |
| `mall_sin_dom` | `ventas` | `V_ML` |
| `mall_autopark` | `ventas` | `V_AP` |
| `mall_7d` | `ventas` | `V_M7` |
| `standalone` | `postventa` | `P_SA` |
| `mall_sin_dom` | `postventa` | depende de la comuna (P_MQ, P_MT, P_MO) |
| `mall_7d` | `postventa` | depende de la comuna |

> **Nota**: la distinción entre P_MQ, P_MT, P_MO se basa en la `comuna` del área. El script de seed asigna correctamente según la tabla de áreas.

## Criterios de aceptación

- [ ] Script `seed-shift-catalog-v2.ts` carga todos los turnos en `shift_catalog_v2`.
- [ ] Idempotente.
- [ ] Función helper `getShiftsForGroup(rotationGroup: string): ShiftV2[]` disponible.
- [ ] Tipos TypeScript `ShiftV2` y Pydantic `ShiftInfoV2` creados.
