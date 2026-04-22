/**
 * Helper para buscar un área en el catálogo local (cache en memoria).
 *
 * En specs futuras, este helper consultará Appwrite si el área no está
 * en la cache local. Por ahora usamos el catálogo hardcodeado como fallback
 * para que el parser Excel funcione sin round-trip a Appwrite.
 */

import type { AreaCatalog, Clasificacion, TipoFranja } from "@/types/models";

// Catálogo local (espejo del seed). Se mantiene sincronizado con seed-area-catalog.ts.
// Si se agrega un área en Appwrite, actualizarlo aquí también.
const CATALOG: Record<string, Omit<AreaCatalog, "$id">> = {
  "108":  { nombre_display: "Seminuevos Autoshopping",          clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Autopark" },
  "1106": { nombre_display: "Seminuevos Bilbao",                clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Bilbao" },
  "103":  { nombre_display: "Seminuevos Gran Avenida",          clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "107":  { nombre_display: "Seminuevos Movicenter",            clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "1201": { nombre_display: "Local Kia Gran Avenida",           clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "101":  { nombre_display: "Seminuevos Irarrazaval 1330",      clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "1108": { nombre_display: "Seminuevos Mall Plaza Oeste",      clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Oeste" },
  "1200": { nombre_display: "Local Nissan Irarrazaval 965",     clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "104":  { nombre_display: "Seminuevos Maipú",                 clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "1221": { nombre_display: "Local Kia Mall Plaza Tobalaba",    clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Tobalaba" },
  "130":  { nombre_display: "Local DFSK Mall Plaza Oeste",      clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Oeste" },
  "1320": { nombre_display: "Local Nissan Gran Avenida",        clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "133":  { nombre_display: "Local Subaru Mall Plaza Vespucio", clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Vespucio" },
  "1350": { nombre_display: "Nissan Flota",                     clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Bilbao" },
  "135":  { nombre_display: "Local Subaru Mall Plaza Oeste",    clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Oeste" },
  "1211": { nombre_display: "Local Kia Mall Plaza Oeste",       clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Oeste" },
  "124":  { nombre_display: "Local Kia Mall Arauco Maipu",      clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Arauco" },
  "128":  { nombre_display: "Local Nissan Bilbao",              clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Bilbao" },
  "330":  { nombre_display: "Local Geely Bilbao",               clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Bilbao" },
  "1361": { nombre_display: "Local Nissan Mall Plaza Sur",      clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "1362": { nombre_display: "Local Nissan Movicenter",          clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "1410": { nombre_display: "Local DFSK Mall Plaza Tobalaba",   clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Tobalaba" },
  "402":  { nombre_display: "Local Citroën Bilbao",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Bilbao" },
  "1413": { nombre_display: "Local DFSK Mall Arauco Maipu",     clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Arauco" },
  "1412": { nombre_display: "Local DFSK Gran Avenida",          clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "143":  { nombre_display: "Local DFSK Mall Plaza Sur",        clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "144":  { nombre_display: "Local Subaru Mall Plaza Sur",      clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "145":  { nombre_display: "Local Subaru Mall Plaza Tobalaba", clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Tobalaba" },
  "331":  { nombre_display: "Local Geely Gran Avenida",         clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "511":  { nombre_display: "Local Landking Gran Avenida",      clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Gran Avenida" },
  "320":  { nombre_display: "Local MG Movicenter",              clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "324":  { nombre_display: "Local MG Independencia",           clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Independencia" },
  "321":  { nombre_display: "MG Virtual",                       clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "322":  { nombre_display: "Local MG Irarrázaval",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "336":  { nombre_display: "Local Geely Irarrázaval",          clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "360":  { nombre_display: "Local Opel Irarrazaval",           clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "401":  { nombre_display: "Local Citroën Irarrázaval 965",    clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Irarrázaval" },
  "134":  { nombre_display: "Local Kia Red Cube Maipu",         clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "332":  { nombre_display: "Local Geely Mall Plaza Oeste",     clasificacion: "mall_sin_dom", tipo_franja: "movicenter",  comuna: "Oeste" },
  "343":  { nombre_display: "Local Peugeot Camino Melipilla",   clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "344":  { nombre_display: "Virtual Peugeot",                  clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "352":  { nombre_display: "Local Opel Camino Melipilla",      clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "337":  { nombre_display: "Local Geely Mall Arauco Maipu",    clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Arauco" },
  "340":  { nombre_display: "Local Peugeot Movicenter",         clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "341":  { nombre_display: "Local Peugeot Mall Arauco Maipu",  clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Arauco" },
  "500":  { nombre_display: "Transportes Maipú",                clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "510":  { nombre_display: "Local Landking Maipú",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Maipú" },
  "345":  { nombre_display: "Local Peugeot Mall Plaza Sur",     clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "1414": { nombre_display: "Local DFSK Melipilla",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Melipilla" },
  "350":  { nombre_display: "Local Opel Movicenter",            clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "351":  { nombre_display: "Local Opel Mall Plaza Egaña",      clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Egaña" },
  "151":  { nombre_display: "Local Kia Melipilla",              clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Melipilla" },
  "353":  { nombre_display: "Local Opel Mall Plaza Sur",        clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "325":  { nombre_display: "Local MG Melipilla",               clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Melipilla" },
  "334":  { nombre_display: "Local Geely Melipilla",            clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Melipilla" },
  "153":  { nombre_display: "Local Kia Quilin",                 clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Quilín" },
  "323":  { nombre_display: "Local MG Quilin",                  clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Quilín" },
  "403":  { nombre_display: "Local Citroën Mall Plaza Sur",     clasificacion: "mall_7d",      tipo_franja: "sur",         comuna: "Sur" },
  "404":  { nombre_display: "Local Citroën Movicenter",         clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
  "335":  { nombre_display: "Local Geely Quilin",               clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Quilín" },
  "346":  { nombre_display: "Local Peugeot Quilín",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Quilín" },
  "400":  { nombre_display: "Local Citroën Quilín",             clasificacion: "standalone",   tipo_franja: "standalone",  comuna: "Quilín" },
  "550":  { nombre_display: "Leap Motor Movicenter",            clasificacion: "mall_7d",      tipo_franja: "movicenter",  comuna: "Movicenter" },
};

/**
 * Busca un área por su código numérico.
 * Retorna null si el código no está en el catálogo local.
 */
export function lookupArea(codigoArea: string): AreaCatalog | null {
  const entry = CATALOG[codigoArea.trim()];
  if (!entry) return null;
  return { $id: codigoArea.trim(), ...entry };
}

/**
 * Determina el rotation_group a partir de clasificación y área de negocio.
 * Se usa al crear/actualizar workers desde el Excel.
 */
export function getRotationGroup(
  clasificacion: Clasificacion,
  areaNegocio: "ventas" | "postventa",
  comuna?: string
): string {
  if (areaNegocio === "ventas") {
    if (clasificacion === "mall_7d")      return "V_M7";
    if (clasificacion === "mall_autopark") return "V_AP";
    if (clasificacion === "mall_sin_dom")  return "V_ML";
    return "V_SA"; // standalone
  }

  // postventa — depende de la comuna para diferenciar P_MO, P_MQ, P_MT
  if (clasificacion === "standalone")   return "P_SA";
  if (clasificacion === "mall_sin_dom" || clasificacion === "mall_7d") {
    if (comuna === "Oeste")                          return "P_MO";
    if (comuna === "Tobalaba")                       return "P_MT";
    if (comuna === "Quilín" || comuna === "Movicenter") return "P_MQ";
    return "P_MQ"; // default para otros malls postventa
  }

  return "P_SA"; // fallback
}
