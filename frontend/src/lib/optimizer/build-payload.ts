import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { OptimizerConstraint } from "@/lib/exceptions/to-optimizer-constraint";
import type { Worker, Branch, BranchTypeConfig, Holiday } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export interface WorkerInputPayload {
  rut: string;
  nombre: string;
  constraints: OptimizerConstraint[];
}

export interface OptimizePayload {
  branch: {
    id: string;
    codigo_area: string;
    nombre: string;
    tipo_franja: string;
  };
  month: { year: number; month: number };
  workers: WorkerInputPayload[];
  holidays: string[];
  shift_catalog: {
    id: string;
    inicio: string;
    fin: string;
    duracion_minutos: number;
    descuenta_colacion: boolean;
  }[];
  franja_por_dia: Record<string, { apertura: string | null; cierre: string | null } | null>;
  carryover_horas: Record<string, number>;
  parametros?: Record<string, unknown>;
}

// Pure: genera workers anónimos para el optimizer. Los nombres reales se asignan
// después con el panel de mapeo en el calendario.
export function buildWorkersForPayload(workers: Worker[]): WorkerInputPayload[] {
  return workers.map((_, i) => ({
    rut: `worker_${i + 1}`,
    nombre: `Trabajador ${i + 1}`,
    constraints: [] as OptimizerConstraint[],
  }));
}

// Genera todos los turnos posibles con inicio/fin alineados a 30 min dentro
// del rango global de apertura–cierre de la sucursal. El ILP solo asignará
// los que comiencen ≥ apertura del día específico (_is_shift_assignable).
function generateFreeShifts(
  franjaPorDia: Record<string, { apertura: string | null; cierre: string | null } | null>
): OptimizePayload["shift_catalog"] {
  const MIN_DURATION = 240;  // 4 horas en minutos
  const MAX_DURATION = 600;  // 10 horas en minutos

  let minApertura = Infinity;
  let maxCierre = 0;

  for (const franja of Object.values(franjaPorDia)) {
    if (!franja?.apertura || !franja?.cierre) continue;
    const [ah, am] = franja.apertura.split(":").map(Number);
    const [ch, cm] = franja.cierre.split(":").map(Number);
    minApertura = Math.min(minApertura, ah * 60 + am);
    maxCierre = Math.max(maxCierre, ch * 60 + cm);
  }

  if (!isFinite(minApertura) || maxCierre === 0) return [];

  const toTime = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  const shifts: OptimizePayload["shift_catalog"] = [];
  for (let start = minApertura; start + MIN_DURATION <= maxCierre; start += 30) {
    const endLimit = Math.min(maxCierre, start + MAX_DURATION);
    for (let end = start + MIN_DURATION; end <= endLimit; end += 30) {
      const id = `T${toTime(start).replace(":", "")}_${toTime(end).replace(":", "")}`;
      shifts.push({
        id,
        inicio: toTime(start),
        fin: toTime(end),
        duracion_minutos: end - start,
        descuenta_colacion: false,
      });
    }
  }

  return shifts;
}

// Async: fetch todo desde Appwrite y arma el payload completo para POST /optimize.
export async function buildOptimizePayload(
  branchId: string,
  year: number,
  month: number
): Promise<OptimizePayload> {
  const branchDoc = await databases.getDocument(DB, "branches", branchId);
  const branch = branchDoc as unknown as Branch;

  // branch_type_config: el $id del documento es el mismo valor que tipo_franja
  const config = await databases
    .getDocument(DB, "branch_type_config", branch.tipo_franja)
    .then((doc) => doc as unknown as BranchTypeConfig)
    .catch(() => undefined);

  const workersResult = await databases.listDocuments(DB, "workers", [
    Query.equal("branch_id", branchId),
    Query.equal("activo", true),
    Query.limit(200),
  ]);
  const workers = workersResult.documents as unknown as Worker[];

  const holidaysResult = await databases.listDocuments(DB, "holidays", [
    Query.equal("anio", year),
    Query.limit(50),
  ]);
  const holidays = (holidaysResult.documents as unknown as Holiday[]).map((h) => h.fecha);

  const franja_por_dia = (() => {
    const raw = config?.franja_por_dia;
    if (!raw) return {} as OptimizePayload["franja_por_dia"];
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as OptimizePayload["franja_por_dia"];
  })();

  return {
    branch: {
      id: branchId,
      codigo_area: branch.codigo_area,
      nombre: branch.nombre,
      tipo_franja: branch.tipo_franja,
    },
    month: { year, month },
    workers: buildWorkersForPayload(workers),
    holidays,
    shift_catalog: generateFreeShifts(franja_por_dia),
    franja_por_dia,
    carryover_horas: {},
  };
}
