import "dotenv/config";
import { Client, Databases, AppwriteException } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

type Franja = { apertura: string | null; cierre: string | null };
type FranjaSemanal = Record<string, Franja>;

interface BranchTypeConfigSeed {
  id: string;
  nombre_display: string;
  franja_por_dia: FranjaSemanal;
  shifts_aplicables: string[];
}

const abierto = (apertura: string, cierre: string): Franja => ({ apertura, cierre });
const cerrado: Franja = { apertura: null, cierre: null };

const BRANCH_TYPE_CONFIGS: BranchTypeConfigSeed[] = [
  {
    id: "standalone",
    nombre_display: "Standalone",
    franja_por_dia: {
      lunes:     abierto("09:00", "19:00"),
      martes:    abierto("09:00", "19:00"),
      miercoles: abierto("09:00", "19:00"),
      jueves:    abierto("09:00", "19:00"),
      viernes:   abierto("09:00", "19:00"),
      sabado:    abierto("10:00", "14:00"),
      domingo:   cerrado,
    },
    shifts_aplicables: ["S_09_19", "S_10_14", "S_12_20", "S_13_20", "S_10_17"],
  },
  {
    id: "autopark",
    nombre_display: "Autopark",
    franja_por_dia: {
      lunes:     abierto("09:00", "19:00"),
      martes:    abierto("09:00", "19:00"),
      miercoles: abierto("09:00", "19:00"),
      jueves:    abierto("09:00", "19:00"),
      viernes:   abierto("09:00", "19:00"),
      sabado:    abierto("09:00", "19:00"),
      domingo:   cerrado,
    },
    shifts_aplicables: ["S_09_19", "S_10_19", "S_13_20", "S_10_17", "S_12_20"],
  },
  {
    id: "movicenter",
    nombre_display: "Movicenter",
    franja_por_dia: {
      lunes:     abierto("10:00", "20:00"),
      martes:    abierto("10:00", "20:00"),
      miercoles: abierto("10:00", "20:00"),
      jueves:    abierto("10:00", "20:00"),
      viernes:   abierto("10:00", "20:00"),
      sabado:    abierto("10:00", "20:00"),
      domingo:   abierto("10:00", "20:00"),
    },
    shifts_aplicables: ["S_10_20", "S_11_20", "S_10_19", "S_13_20", "S_10_17", "S_12_20"],
  },
  {
    id: "tqaoev",
    nombre_display: "TQAOEV",
    franja_por_dia: {
      lunes:     abierto("10:00", "20:00"),
      martes:    abierto("10:00", "20:00"),
      miercoles: abierto("10:00", "20:00"),
      jueves:    abierto("10:00", "20:00"),
      viernes:   abierto("10:00", "20:00"),
      sabado:    abierto("10:00", "20:00"),
      domingo:   abierto("11:00", "20:00"),
    },
    shifts_aplicables: ["S_10_20", "S_11_20", "S_10_19", "S_13_20", "S_10_17", "S_12_20"],
  },
  {
    id: "sur",
    nombre_display: "Sur",
    franja_por_dia: {
      lunes:     abierto("10:30", "20:30"),
      martes:    abierto("10:30", "20:30"),
      miercoles: abierto("10:30", "20:30"),
      jueves:    abierto("10:30", "20:30"),
      viernes:   abierto("10:30", "21:00"),
      sabado:    abierto("10:30", "20:30"),
      domingo:   abierto("11:00", "20:00"),
    },
    shifts_aplicables: ["S_1030_2030", "S_1030_21", "S_11_20", "S_13_20", "S_10_17", "S_12_20"],
  },
];

async function main() {
  console.log("=== seed-branch-type-config ===");

  let created = 0;
  let skipped = 0;

  for (const config of BRANCH_TYPE_CONFIGS) {
    const { id, franja_por_dia, shifts_aplicables, nombre_display } = config;
    const data = {
      nombre_display,
      franja_por_dia: JSON.stringify(franja_por_dia),
      shifts_aplicables,
    };
    try {
      await db.createDocument(DB, "branch_type_config", id, data);
      console.log(`  ✓ ${id} — ${nombre_display}`);
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

  console.log(`\n  creados: ${created} | skipped: ${skipped} | total: ${BRANCH_TYPE_CONFIGS.length}`);
  console.log("=== seed completo ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
