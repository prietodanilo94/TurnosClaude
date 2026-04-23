import { Client, Databases, ID } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: "../.env" }); // fallback

if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
  console.error("Faltan variables de entorno para Appwrite");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DB_ID = "main-v2";
const COLL_ID = "shift_catalog_v2";

interface SeedShift {
  id: string;
  nombre_display: string;
  rotation_group: string;
  nombre_turno: string;
  horario_por_dia: Record<string, { inicio: string; fin: string }>;
  descuenta_colacion: boolean;
  dias_aplicables: string[];
}

const SHIFTS: SeedShift[] = [
  // ─── V_SA (Ventas Stand Alone) ──────────────────────────
  {
    id: "V_SA_APE",
    rotation_group: "V_SA",
    nombre_turno: "apertura",
    nombre_display: "Apertura",
    horario_por_dia: {
      lunes: { inicio: "09:00", fin: "17:30" },
      martes: { inicio: "09:00", fin: "17:30" },
      miercoles: { inicio: "09:00", fin: "17:30" },
      jueves: { inicio: "09:00", fin: "17:30" },
      viernes: { inicio: "09:00", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "V_SA_CIE",
    rotation_group: "V_SA",
    nombre_turno: "cierre",
    nombre_display: "Cierre",
    horario_por_dia: {
      lunes: { inicio: "10:30", fin: "19:00" },
      martes: { inicio: "10:30", fin: "19:00" },
      miercoles: { inicio: "10:30", fin: "19:00" },
      jueves: { inicio: "10:30", fin: "19:00" },
      viernes: { inicio: "10:30", fin: "19:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "V_SA_SAB",
    rotation_group: "V_SA",
    nombre_turno: "sabado",
    nombre_display: "Sábado",
    horario_por_dia: {
      sabado: { inicio: "10:00", fin: "14:30" },
    },
    descuenta_colacion: false,
    dias_aplicables: ["sabado"],
  },

  // ─── V_ML (Ventas Mall sin domingo) ─────────────────────
  {
    id: "V_ML_APE",
    rotation_group: "V_ML",
    nombre_turno: "apertura",
    nombre_display: "Apertura",
    horario_por_dia: {
      lunes: { inicio: "10:00", fin: "18:00" },
      martes: { inicio: "10:00", fin: "18:00" },
      miercoles: { inicio: "10:00", fin: "18:00" },
      jueves: { inicio: "10:00", fin: "18:00" },
      viernes: { inicio: "10:00", fin: "18:00" },
      sabado: { inicio: "10:00", fin: "18:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },
  {
    id: "V_ML_CIE",
    rotation_group: "V_ML",
    nombre_turno: "cierre",
    nombre_display: "Cierre",
    horario_por_dia: {
      lunes: { inicio: "12:00", fin: "20:00" },
      martes: { inicio: "12:00", fin: "20:00" },
      miercoles: { inicio: "12:00", fin: "20:00" },
      jueves: { inicio: "12:00", fin: "20:00" },
      viernes: { inicio: "12:00", fin: "20:00" },
      sabado: { inicio: "12:00", fin: "20:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── V_AP (Ventas Mall Autopark) ────────────────────────
  {
    id: "V_AP_APE",
    rotation_group: "V_AP",
    nombre_turno: "apertura",
    nombre_display: "Apertura",
    horario_por_dia: {
      lunes: { inicio: "10:00", fin: "18:00" },
      martes: { inicio: "10:00", fin: "18:00" },
      miercoles: { inicio: "10:00", fin: "18:00" },
      jueves: { inicio: "10:00", fin: "18:00" },
      viernes: { inicio: "10:00", fin: "18:00" },
      sabado: { inicio: "10:00", fin: "18:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },
  {
    id: "V_AP_CIE",
    rotation_group: "V_AP",
    nombre_turno: "cierre",
    nombre_display: "Cierre",
    horario_por_dia: {
      lunes: { inicio: "11:00", fin: "19:00" },
      martes: { inicio: "11:00", fin: "19:00" },
      miercoles: { inicio: "11:00", fin: "19:00" },
      jueves: { inicio: "11:00", fin: "19:00" },
      viernes: { inicio: "11:00", fin: "19:00" },
      sabado: { inicio: "12:00", fin: "19:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── V_M7 (Ventas Mall 7 días) ──────────────────────────
  {
    id: "V_M7_APE",
    rotation_group: "V_M7",
    nombre_turno: "apertura",
    nombre_display: "Apertura Corta",
    horario_por_dia: {
      lunes: { inicio: "10:00", fin: "19:00" },
      martes: { inicio: "10:00", fin: "19:00" },
      miercoles: { inicio: "10:00", fin: "19:00" },
      jueves: { inicio: "10:00", fin: "19:00" },
      viernes: { inicio: "10:00", fin: "19:00" },
      sabado: { inicio: "10:00", fin: "19:00" },
      domingo: { inicio: "10:00", fin: "19:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
  },
  {
    id: "V_M7_CIE",
    rotation_group: "V_M7",
    nombre_turno: "cierre",
    nombre_display: "Cierre Corto",
    horario_por_dia: {
      lunes: { inicio: "11:00", fin: "20:00" },
      martes: { inicio: "11:00", fin: "20:00" },
      miercoles: { inicio: "11:00", fin: "20:00" },
      jueves: { inicio: "11:00", fin: "20:00" },
      viernes: { inicio: "11:00", fin: "20:00" },
      sabado: { inicio: "11:00", fin: "20:00" },
      domingo: { inicio: "11:00", fin: "20:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
  },
  {
    id: "V_M7_COM",
    rotation_group: "V_M7",
    nombre_turno: "completo",
    nombre_display: "Completo",
    horario_por_dia: {
      lunes: { inicio: "10:00", fin: "20:00" },
      martes: { inicio: "10:00", fin: "20:00" },
      miercoles: { inicio: "10:00", fin: "20:00" },
      jueves: { inicio: "10:00", fin: "20:00" },
      viernes: { inicio: "10:00", fin: "20:00" },
      sabado: { inicio: "10:00", fin: "20:00" },
      domingo: { inicio: "10:00", fin: "20:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
  },

  // ─── P_SA (Postventa Stand Alone) ───────────────────────
  {
    id: "P_SA_A",
    rotation_group: "P_SA",
    nombre_turno: "opcion_a",
    nombre_display: "Postventa Stand Alone A",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "18:00" },
      martes: { inicio: "08:30", fin: "18:00" },
      miercoles: { inicio: "08:30", fin: "18:00" },
      jueves: { inicio: "08:30", fin: "18:00" },
      viernes: { inicio: "08:30", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "P_SA_B",
    rotation_group: "P_SA",
    nombre_turno: "opcion_b",
    nombre_display: "Postventa Stand Alone B",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "17:00" },
      martes: { inicio: "08:30", fin: "17:00" },
      miercoles: { inicio: "08:30", fin: "17:00" },
      jueves: { inicio: "08:30", fin: "17:00" },
      viernes: { inicio: "08:30", fin: "16:30" },
      sabado: { inicio: "09:00", fin: "14:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── P_MQ (Postventa Mall Quilín / Movicenter) ──────────
  {
    id: "P_MQ_A",
    rotation_group: "P_MQ",
    nombre_turno: "opcion_a",
    nombre_display: "Postventa Movicenter A",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "18:00" },
      martes: { inicio: "08:30", fin: "18:00" },
      miercoles: { inicio: "08:30", fin: "18:00" },
      jueves: { inicio: "08:30", fin: "18:00" },
      viernes: { inicio: "08:30", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "P_MQ_B",
    rotation_group: "P_MQ",
    nombre_turno: "opcion_b",
    nombre_display: "Postventa Movicenter B",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "17:00" },
      martes: { inicio: "08:30", fin: "17:00" },
      miercoles: { inicio: "08:30", fin: "17:00" },
      jueves: { inicio: "08:30", fin: "17:00" },
      viernes: { inicio: "08:30", fin: "16:30" },
      sabado: { inicio: "09:00", fin: "14:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── P_MT (Postventa Mall Tobalaba) ─────────────────────
  {
    id: "P_MT_A",
    rotation_group: "P_MT",
    nombre_turno: "opcion_a",
    nombre_display: "Postventa Tobalaba A",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "18:00" },
      martes: { inicio: "08:30", fin: "18:00" },
      miercoles: { inicio: "08:30", fin: "18:00" },
      jueves: { inicio: "08:30", fin: "18:00" },
      viernes: { inicio: "08:30", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "P_MT_B",
    rotation_group: "P_MT",
    nombre_turno: "opcion_b",
    nombre_display: "Postventa Tobalaba B",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "17:00" },
      martes: { inicio: "08:30", fin: "17:00" },
      miercoles: { inicio: "08:30", fin: "17:00" },
      jueves: { inicio: "08:30", fin: "17:00" },
      viernes: { inicio: "08:30", fin: "16:30" },
      sabado: { inicio: "09:00", fin: "14:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── P_MO (Postventa Mall Oeste) ────────────────────────
  {
    id: "P_MO_A",
    rotation_group: "P_MO",
    nombre_turno: "opcion_a",
    nombre_display: "Postventa Oeste A",
    horario_por_dia: {
      lunes: { inicio: "08:00", fin: "17:30" },
      martes: { inicio: "08:00", fin: "17:30" },
      miercoles: { inicio: "08:00", fin: "17:30" },
      jueves: { inicio: "08:00", fin: "17:30" },
      viernes: { inicio: "08:00", fin: "17:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "P_MO_B",
    rotation_group: "P_MO",
    nombre_turno: "opcion_b",
    nombre_display: "Postventa Oeste B",
    horario_por_dia: {
      lunes: { inicio: "08:00", fin: "16:30" },
      martes: { inicio: "08:00", fin: "16:30" },
      miercoles: { inicio: "08:00", fin: "16:30" },
      jueves: { inicio: "08:00", fin: "16:30" },
      viernes: { inicio: "08:00", fin: "16:00" },
      sabado: { inicio: "09:00", fin: "14:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── P_CAP (Postventa CAP) ──────────────────────────────
  {
    id: "P_CAP_A",
    rotation_group: "P_CAP",
    nombre_turno: "opcion_a",
    nombre_display: "Postventa CAP A",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "18:00" },
      martes: { inicio: "08:30", fin: "18:00" },
      miercoles: { inicio: "08:30", fin: "18:00" },
      jueves: { inicio: "08:30", fin: "18:00" },
      viernes: { inicio: "08:30", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "P_CAP_B",
    rotation_group: "P_CAP",
    nombre_turno: "opcion_b",
    nombre_display: "Postventa CAP B",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "17:00" },
      martes: { inicio: "08:30", fin: "17:00" },
      miercoles: { inicio: "08:30", fin: "17:00" },
      jueves: { inicio: "08:30", fin: "17:00" },
      viernes: { inicio: "08:30", fin: "16:30" },
      sabado: { inicio: "09:00", fin: "14:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
  },

  // ─── Turnos Únicos ──────────────────────────────────────
  {
    id: "U_BO",
    rotation_group: "U_BO",
    nombre_turno: "unico",
    nombre_display: "BO Administrativos",
    horario_por_dia: {
      lunes: { inicio: "09:00", fin: "18:30" },
      martes: { inicio: "09:00", fin: "18:30" },
      miercoles: { inicio: "09:00", fin: "18:30" },
      jueves: { inicio: "09:00", fin: "18:30" },
      viernes: { inicio: "09:00", fin: "18:00" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
  {
    id: "U_DP",
    rotation_group: "U_DP",
    nombre_turno: "unico",
    nombre_display: "D y P Vista Hermosa",
    horario_por_dia: {
      lunes: { inicio: "08:30", fin: "18:00" },
      martes: { inicio: "08:30", fin: "18:00" },
      miercoles: { inicio: "08:30", fin: "18:00" },
      jueves: { inicio: "08:30", fin: "18:00" },
      viernes: { inicio: "08:30", fin: "17:30" },
    },
    descuenta_colacion: true,
    dias_aplicables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
  },
];

async function main() {
  console.log("Sembrando catálogo de turnos v2...");
  let creados = 0;
  let actualizados = 0;

  for (const shift of SHIFTS) {
    try {
      const data = {
        rotation_group: shift.rotation_group,
        nombre_turno: shift.nombre_turno,
        nombre_display: shift.nombre_display,
        horario_por_dia: JSON.stringify(shift.horario_por_dia),
        descuenta_colacion: shift.descuenta_colacion,
        dias_aplicables: shift.dias_aplicables,
      };

      try {
        await db.getDocument(DB_ID, COLL_ID, shift.id);
        await db.updateDocument(DB_ID, COLL_ID, shift.id, data);
        actualizados++;
      } catch (err: any) {
        if (err.code === 404) {
          await db.createDocument(DB_ID, COLL_ID, shift.id, data);
          creados++;
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`Error procesando el turno ${shift.id}:`, err);
    }
  }

  console.log(`\nCompletado!`);
  console.log(`- Turnos creados: ${creados}`);
  console.log(`- Turnos actualizados: ${actualizados}`);
}

main().catch(console.error);
