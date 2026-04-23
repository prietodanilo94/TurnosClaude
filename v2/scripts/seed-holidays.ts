import "dotenv/config";
import { AppwriteException, Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

interface HolidaySeed {
  fecha: string;
  nombre: string;
  tipo: "irrenunciable";
  anio: number;
}

// Feriados irrenunciables aplicables a comercio retail.
function getHolidays(year: number): HolidaySeed[] {
  const d = (month: number, day: number): string =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000+00:00`;

  return [
    { fecha: d(1, 1), nombre: "Año Nuevo", tipo: "irrenunciable", anio: year },
    { fecha: d(5, 1), nombre: "Día del Trabajador", tipo: "irrenunciable", anio: year },
    { fecha: d(9, 18), nombre: "Fiestas Patrias", tipo: "irrenunciable", anio: year },
    { fecha: d(12, 25), nombre: "Navidad", tipo: "irrenunciable", anio: year },
  ];
}

async function seedHolidays(year: number): Promise<void> {
  console.log(`\n[${year}]`);
  const holidays = getHolidays(year);
  let created = 0;
  let skipped = 0;

  for (const holiday of holidays) {
    const id = `holiday-${holiday.fecha.slice(0, 10)}`;
    try {
      await db.createDocument(DB, "holidays", id, holiday);
      console.log(`  ✓ ${holiday.fecha.slice(0, 10)} - ${holiday.nombre}`);
      created++;
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        console.log(`  ↷ ${holiday.fecha.slice(0, 10)} ya existia, skip`);
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`  creados: ${created} | skipped: ${skipped}`);
}

async function main() {
  const years = process.argv.slice(2).map(Number).filter((value) => value > 2000);
  const targets = years.length > 0 ? years : [2026, 2027];

  console.log("=== seed-holidays-v2 ===");
  console.log(`años: ${targets.join(", ")}`);

  for (const year of targets) {
    await seedHolidays(year);
  }

  console.log("\n=== seed completo ===");
}

main().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
