import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
// Query se sigue usando para workers y constraints
import { toOptimizerConstraint } from "@/lib/exceptions/to-optimizer-constraint";
import type { OptimizerConstraint } from "@/lib/exceptions/to-optimizer-constraint";
import type { Worker, Branch, BranchTypeConfig, ShiftCatalog, Holiday, WorkerConstraint } from "@/types/models";

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
  parametros?: Record<string, unknown>;
}

// Pure: mapea workers + sus constraints al shape del payload. Testeable sin Appwrite.
export function buildWorkersForPayload(
  workers: Worker[],
  allConstraints: WorkerConstraint[]
): WorkerInputPayload[] {
  return workers.map((w) => ({
    rut: w.rut,
    nombre: w.nombre_completo,
    constraints: allConstraints
      .filter((c) => c.worker_id === w.$id)
      .map(toOptimizerConstraint),
  }));
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

  // Fetch constraints en chunks de 25 (límite de Query.equal con array)
  const allConstraints: WorkerConstraint[] = [];
  const workerIds = workers.map((w) => w.$id);
  for (let i = 0; i < workerIds.length; i += 25) {
    const chunk = workerIds.slice(i, i + 25);
    const cResult = await databases.listDocuments(DB, "worker_constraints", [
      Query.equal("worker_id", chunk),
      Query.limit(500),
    ]);
    allConstraints.push(...(cResult.documents as unknown as WorkerConstraint[]));
  }

  const shiftsResult = await databases.listDocuments(DB, "shift_catalog", [Query.limit(50)]);
  const allShifts = shiftsResult.documents as unknown as ShiftCatalog[];
  const aplicables = new Set(config?.shifts_aplicables ?? []);
  const shiftCatalog = (aplicables.size > 0
    ? allShifts.filter((s) => aplicables.has(s.$id))
    : allShifts
  ).map((s) => ({
    id: s.$id,
    inicio: s.hora_inicio,
    fin: s.hora_fin,
    duracion_minutos: s.duracion_minutos,
    descuenta_colacion: s.descuenta_colacion,
  }));

  const holidaysResult = await databases.listDocuments(DB, "holidays", [
    Query.equal("anio", year),
    Query.limit(50),
  ]);
  const holidays = (holidaysResult.documents as unknown as Holiday[]).map((h) => h.fecha);

  return {
    branch: {
      id: branchId,
      codigo_area: branch.codigo_area,
      nombre: branch.nombre,
      tipo_franja: branch.tipo_franja,
    },
    month: { year, month },
    workers: buildWorkersForPayload(workers, allConstraints),
    holidays,
    shift_catalog: shiftCatalog,
    franja_por_dia: (() => {
      const raw = config?.franja_por_dia;
      if (!raw) return {};
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    })() as OptimizePayload["franja_por_dia"],
  };
}
