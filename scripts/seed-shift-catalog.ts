import "dotenv/config";
import { Client, Databases, AppwriteException } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

interface ShiftSeed {
  id: string;
  nombre_display: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  descuenta_colacion: boolean;
  categoria: "principal" | "adicional";
}

// Regla de colación: turnos de 4 o 5 h no descuentan; 6 h+ sí.
const SHIFTS: ShiftSeed[] = [
  {
    id: "S_10_20",
    nombre_display: "10:00 a 20:00",
    hora_inicio: "10:00",
    hora_fin: "20:00",
    duracion_minutos: 600,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_11_20",
    nombre_display: "11:00 a 20:00",
    hora_inicio: "11:00",
    hora_fin: "20:00",
    duracion_minutos: 540,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_10_19",
    nombre_display: "10:00 a 19:00",
    hora_inicio: "10:00",
    hora_fin: "19:00",
    duracion_minutos: 540,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_1030_2030",
    nombre_display: "10:30 a 20:30",
    hora_inicio: "10:30",
    hora_fin: "20:30",
    duracion_minutos: 600,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_1030_21",
    nombre_display: "10:30 a 21:00",
    hora_inicio: "10:30",
    hora_fin: "21:00",
    duracion_minutos: 630,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_09_19",
    nombre_display: "09:00 a 19:00",
    hora_inicio: "09:00",
    hora_fin: "19:00",
    duracion_minutos: 600,
    descuenta_colacion: true,
    categoria: "principal",
  },
  {
    id: "S_10_14",
    nombre_display: "10:00 a 14:00",
    hora_inicio: "10:00",
    hora_fin: "14:00",
    duracion_minutos: 240,
    descuenta_colacion: false,
    categoria: "principal",
  },
  {
    id: "S_13_20",
    nombre_display: "13:00 a 20:00",
    hora_inicio: "13:00",
    hora_fin: "20:00",
    duracion_minutos: 420,
    descuenta_colacion: true,
    categoria: "adicional",
  },
  {
    id: "S_10_17",
    nombre_display: "10:00 a 17:00",
    hora_inicio: "10:00",
    hora_fin: "17:00",
    duracion_minutos: 420,
    descuenta_colacion: true,
    categoria: "adicional",
  },
  {
    id: "S_12_20",
    nombre_display: "12:00 a 20:00",
    hora_inicio: "12:00",
    hora_fin: "20:00",
    duracion_minutos: 480,
    descuenta_colacion: true,
    categoria: "adicional",
  },
];

async function main() {
  console.log("=== seed-shift-catalog ===");

  let created = 0;
  let skipped = 0;

  for (const shift of SHIFTS) {
    const { id, ...data } = shift;
    try {
      await db.createDocument(DB, "shift_catalog", id, data);
      console.log(`  ✓ ${id} — ${data.nombre_display}`);
      created++;
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 409) {
        console.log(`  ↷ ${id} ya existía, skip`);
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`\n  creados: ${created} | skipped: ${skipped} | total: ${SHIFTS.length}`);
  console.log("=== seed completo ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
