/**
 * Registro canónico de categorías de turno (patrones de horario).
 *
 * FUENTE ÚNICA DE VERDAD para el tipo ShiftCategory.
 * No editar esta lista sin agregar el patrón correspondiente en src/lib/patterns/catalog.ts.
 *
 * Para agregar una nueva categoría:
 * 1. Agregar el ID aquí en SHIFT_CATEGORIES
 * 2. Agregar el patrón en catalog.ts con el mismo id
 * 3. El tipo ShiftCategory se actualiza automáticamente (keyof derivado)
 */
export const SHIFT_CATEGORIES = [
  // Ventas — Standalone (rotación 2 semanas)
  "ventas_standalone",

  // Ventas — Óptimo (rotación 4 semanas, distintas configuraciones por mall)
  "optimo_autoplaza",
  "optimo_kia_tobalaba",
  "optimo_arauco_maipu",
  "optimo_movicenter",
  "optimo_autopark",

  // Ventas — Formatos especiales
  "ventas_mall_7d",       // 7 días (sin día fijo libre)
  "ventas_geely_oeste",
  "ventas_usados_oeste",
  "ventas_kia_oeste",
  "ventas_dfsk_oeste",
  "ventas_dfsk_oeste2",
  "ventas_dfsk_plaza_sur",
  "ventas_subaru_plaza_sur",

  // Postventa
  "postventa_vista_hermosa",
  "postventa_standalone",
  "postventa_cap",
  "postventa_mall_mqt",   // Movicenter, Quilín, Tobalaba
  "postventa_mall_oeste", // Plaza Oeste
] as const;

export type ShiftCategory = (typeof SHIFT_CATEGORIES)[number];

export const SHIFT_CATEGORY_SET = new Set<string>(SHIFT_CATEGORIES);

export function isValidShiftCategory(value: string): value is ShiftCategory {
  return SHIFT_CATEGORY_SET.has(value);
}

export const AREA_NEGOCIO_VALUES = ["ventas", "postventa"] as const;
export type AreaNegocio = (typeof AREA_NEGOCIO_VALUES)[number];

export function isValidAreaNegocio(value: string): value is AreaNegocio {
  return value === "ventas" || value === "postventa";
}
