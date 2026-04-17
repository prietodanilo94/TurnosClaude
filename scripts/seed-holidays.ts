import "dotenv/config";
import { Client, Databases, AppwriteException } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

interface HolidaySeed {
  fecha: string; // ISO 8601: "YYYY-MM-DDT00:00:00.000+00:00"
  nombre: string;
  tipo: "irrenunciable";
  anio: number;
}

// Feriados irrenunciables chilenos aplicables al negocio:
// 1 ene, 1 may, 18 sep, 19 sep, 25 dic
function getHolidays(year: number): HolidaySeed[] {
  const d = (month: number, day: number): string =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000+00:00`;

  return [
    { fecha: d(1, 1),  nombre: "Año Nuevo",              tipo: "irrenunciable", anio: year },
    { fecha: d(5, 1),  nombre: "Día del Trabajador",     tipo: "irrenunciable", anio: year },
    { fecha: d(9, 18), nombre: "Fiestas Patrias",         tipo: "irrenunciable", anio: year },
    { fecha: d(9, 19), nombre: "Glorias del Ejército",   tipo: "irrenunciable", anio: year },
    { fecha: d(12, 25), nombre: "Navidad",               tipo: "irrenunciable", anio: year },
  ];
}

async function seedHolidays(year: number): Promise<void> {
  console.log(`\n[${year}]`);
  const holidays = getHolidays(year);
  let created = 0;
  let skipped = 0;

  for (const holiday of holidays) {
    // ID estable: "holiday-YYYY-MM-DD"
    const id = `holiday-${holiday.fecha.slice(0, 10)}`;
    try {
      await db.createDocument(DB, "holidays", id, holiday);
      console.log(`  ✓ ${holiday.fecha.slice(0, 10)} — ${holiday.nombre}`);
      created++;
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 409) {
        console.log(`  ↷ ${holiday.fecha.slice(0, 10)} ya existía, skip`);
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`  creados: ${created} | skipped: ${skipped}`);
}

async function main() {
  const years = process.argv.slice(2).map(Number).filter((n) => n > 2000);
  const targets = years.length > 0 ? years : [2026, 2027];

  console.log("=== seed-holidays ===");
  console.log(`años: ${targets.join(", ")}`);

  for (const year of targets) {
    await seedHolidays(year);
  }

  console.log("\n=== seed completo ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
