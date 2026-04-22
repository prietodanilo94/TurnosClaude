import "dotenv/config";
import { Client, Databases, AppwriteException } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!; // main-v2

type Clasificacion = "standalone" | "mall_sin_dom" | "mall_7d" | "mall_autopark";
type TipoFranja = "standalone" | "autopark" | "movicenter" | "tqaoev" | "sur";

interface AreaSeed {
  id: string;            // codigo_area como string
  nombre_display: string;
  clasificacion: Clasificacion;
  tipo_franja: TipoFranja;
  comuna: string;
}

// ─── catálogo completo de 63 áreas ───────────────────────────────────────────
// clasificacion: standalone | mall_sin_dom | mall_7d | mall_autopark
// tipo_franja:   standalone | autopark | movicenter (mall sin dom) | movicenter (mall 7d)
// Malls con domingo (mall_7d): Movicenter, Tobalaba, Vespucio, Arauco, Egaña, Sur
// Mall Oeste → mall_sin_dom (no abre domingo)
// Independencia → mall_sin_dom

const AREAS: AreaSeed[] = [
  { id: "108",  nombre_display: "Seminuevos Autoshopping",          clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Autopark" },
  { id: "1106", nombre_display: "Seminuevos Bilbao",                clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Bilbao" },
  { id: "103",  nombre_display: "Seminuevos Gran Avenida",          clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "107",  nombre_display: "Seminuevos Movicenter",            clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "1201", nombre_display: "Local Kia Gran Avenida",           clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "101",  nombre_display: "Seminuevos Irarrazaval 1330",      clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "1108", nombre_display: "Seminuevos Mall Plaza Oeste",      clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Oeste" },
  { id: "1200", nombre_display: "Local Nissan Irarrazaval 965",     clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "104",  nombre_display: "Seminuevos Maipú",                 clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "1221", nombre_display: "Local Kia Mall Plaza Tobalaba",    clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Tobalaba" },
  { id: "130",  nombre_display: "Local DFSK Mall Plaza Oeste",      clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Oeste" },
  { id: "1320", nombre_display: "Local Nissan Gran Avenida",        clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "133",  nombre_display: "Local Subaru Mall Plaza Vespucio", clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Vespucio" },
  { id: "1350", nombre_display: "Nissan Flota",                     clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Bilbao" },
  { id: "135",  nombre_display: "Local Subaru Mall Plaza Oeste",    clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Oeste" },
  { id: "1211", nombre_display: "Local Kia Mall Plaza Oeste",       clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Oeste" },
  { id: "124",  nombre_display: "Local Kia Mall Arauco Maipu",      clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Arauco" },
  { id: "128",  nombre_display: "Local Nissan Bilbao",              clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Bilbao" },
  { id: "330",  nombre_display: "Local Geely Bilbao",               clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Bilbao" },
  { id: "1361", nombre_display: "Local Nissan Mall Plaza Sur",      clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "1362", nombre_display: "Local Nissan Movicenter",          clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "1410", nombre_display: "Local DFSK Mall Plaza Tobalaba",   clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Tobalaba" },
  { id: "402",  nombre_display: "Local Citroën Bilbao",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Bilbao" },
  { id: "1413", nombre_display: "Local DFSK Mall Arauco Maipu",     clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Arauco" },
  { id: "1412", nombre_display: "Local DFSK Gran Avenida",          clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "143",  nombre_display: "Local DFSK Mall Plaza Sur",        clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "144",  nombre_display: "Local Subaru Mall Plaza Sur",      clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "145",  nombre_display: "Local Subaru Mall Plaza Tobalaba", clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Tobalaba" },
  { id: "331",  nombre_display: "Local Geely Gran Avenida",         clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "511",  nombre_display: "Local Landking Gran Avenida",      clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Gran Avenida" },
  { id: "320",  nombre_display: "Local MG Movicenter",              clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "324",  nombre_display: "Local MG Independencia",           clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Independencia" },
  { id: "321",  nombre_display: "MG Virtual",                       clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "322",  nombre_display: "Local MG Irarrázaval",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "336",  nombre_display: "Local Geely Irarrázaval",          clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "360",  nombre_display: "Local Opel Irarrazaval",           clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "401",  nombre_display: "Local Citroën Irarrázaval 965",    clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Irarrázaval" },
  { id: "134",  nombre_display: "Local Kia Red Cube Maipu",         clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "332",  nombre_display: "Local Geely Mall Plaza Oeste",     clasificacion: "mall_sin_dom",  tipo_franja: "movicenter",  comuna: "Oeste" },
  { id: "343",  nombre_display: "Local Peugeot Camino Melipilla",   clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "344",  nombre_display: "Virtual Peugeot",                  clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "352",  nombre_display: "Local Opel Camino Melipilla",      clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "337",  nombre_display: "Local Geely Mall Arauco Maipu",    clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Arauco" },
  { id: "340",  nombre_display: "Local Peugeot Movicenter",         clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "341",  nombre_display: "Local Peugeot Mall Arauco Maipu",  clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Arauco" },
  { id: "500",  nombre_display: "Transportes Maipú",                clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "510",  nombre_display: "Local Landking Maipú",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Maipú" },
  { id: "345",  nombre_display: "Local Peugeot Mall Plaza Sur",     clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "1414", nombre_display: "Local DFSK Melipilla",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Melipilla" },
  { id: "350",  nombre_display: "Local Opel Movicenter",            clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "351",  nombre_display: "Local Opel Mall Plaza Egaña",      clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Egaña" },
  { id: "151",  nombre_display: "Local Kia Melipilla",              clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Melipilla" },
  { id: "353",  nombre_display: "Local Opel Mall Plaza Sur",        clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "325",  nombre_display: "Local MG Melipilla",               clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Melipilla" },
  { id: "334",  nombre_display: "Local Geely Melipilla",            clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Melipilla" },
  { id: "153",  nombre_display: "Local Kia Quilin",                 clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Quilín" },
  { id: "323",  nombre_display: "Local MG Quilin",                  clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Quilín" },
  { id: "403",  nombre_display: "Local Citroën Mall Plaza Sur",     clasificacion: "mall_7d",       tipo_franja: "sur",         comuna: "Sur" },
  { id: "404",  nombre_display: "Local Citroën Movicenter",         clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
  { id: "335",  nombre_display: "Local Geely Quilin",               clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Quilín" },
  { id: "346",  nombre_display: "Local Peugeot Quilín",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Quilín" },
  { id: "400",  nombre_display: "Local Citroën Quilín",             clasificacion: "standalone",    tipo_franja: "standalone",  comuna: "Quilín" },
  { id: "550",  nombre_display: "Leap Motor Movicenter",            clasificacion: "mall_7d",       tipo_franja: "movicenter",  comuna: "Movicenter" },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== seed-area-catalog ===");
  console.log(`Total áreas a cargar: ${AREAS.length}`);

  let created = 0;
  let skipped = 0;

  for (const area of AREAS) {
    const { id, ...data } = area;
    try {
      await db.createDocument(DB, "area_catalog", id, data);
      console.log(`  ✓ ${id.padStart(4)} — ${data.nombre_display} [${data.clasificacion}]`);
      created++;
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 409) {
        console.log(`  ↷ ${id.padStart(4)} ya existía, skip`);
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`\n  creados: ${created} | skipped: ${skipped} | total: ${AREAS.length}`);
  console.log("=== seed completado ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
