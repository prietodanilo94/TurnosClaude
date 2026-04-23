import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { getShiftsForGroup } from "@/lib/shift-catalog";
import { getRotationGroup, lookupArea } from "@/lib/area-catalog";
import type { OptimizerConstraint } from "@/lib/exceptions/to-optimizer-constraint";
import type { Branch, ShiftV2, Worker } from "@/types/models";
import type { ShiftDef } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

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
  rotation_group: string;
  month: { year: number; month: number };
  workers: WorkerInputPayload[];
  holidays: string[];
  shift_catalog: ShiftDef[];
  franja_por_dia: Record<string, { apertura: string | null; cierre: string | null } | null>;
  carryover_horas: Record<string, number>;
  parametros?: Record<string, unknown>;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function deriveRotationGroup(workers: Worker[], branch: Branch): string {
  const existing = Array.from(
    new Set(workers.map((w) => w.rotation_group).filter((v): v is string => Boolean(v)))
  );

  if (existing.length === 1) return existing[0];
  if (existing.length > 1) {
    throw new Error(
      `La sucursal tiene multiples rotation_group activos (${existing.join(", ")}).`
    );
  }

  const area = lookupArea(branch.codigo_area);
  const areaNegocios = Array.from(
    new Set(workers.map((w) => w.area_negocio).filter((v): v is "ventas" | "postventa" => Boolean(v)))
  );
  const areaNegocio = areaNegocios[0] ?? "ventas";

  if (!area) {
    throw new Error(
      `No se pudo inferir el rotation_group para area ${branch.codigo_area}.`
    );
  }

  return getRotationGroup(area.clasificacion, areaNegocio, area.comuna);
}

function toShiftDef(shift: ShiftV2): ShiftDef {
  return {
    id: shift.$id,
    nombre_display: shift.nombre_display,
    rotation_group: shift.rotation_group,
    nombre_turno: shift.nombre_turno,
    horario_por_dia: shift.horario_por_dia,
    descuenta_colacion: shift.descuenta_colacion,
    dias_aplicables: shift.dias_aplicables,
  };
}

function buildFranjaPorDia(
  shifts: ShiftDef[]
): Record<string, { apertura: string | null; cierre: string | null } | null> {
  const weekdays = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
  ];

  const franja: Record<string, { apertura: string | null; cierre: string | null } | null> = {};

  for (const day of weekdays) {
    const windows = shifts
      .map((shift) => shift.horario_por_dia[day])
      .filter((window): window is { inicio: string; fin: string } => Boolean(window));

    if (windows.length === 0) {
      franja[day] = null;
      continue;
    }

    const apertura = Math.min(...windows.map((w) => parseTime(w.inicio)));
    const cierre = Math.max(...windows.map((w) => parseTime(w.fin)));
    franja[day] = {
      apertura: minutesToTime(apertura),
      cierre: minutesToTime(cierre),
    };
  }

  return franja;
}

export function buildWorkersForPayload(workers: Worker[]): WorkerInputPayload[] {
  return workers.map((worker) => ({
    rut: worker.rut,
    nombre: worker.nombre_completo,
    constraints: [],
  }));
}

export async function buildOptimizePayload(
  branchId: string,
  year: number,
  month: number
): Promise<OptimizePayload> {
  const branchDoc = await databases.getDocument(DB, "branches", branchId);
  const branch = branchDoc as unknown as Branch;

  const workersResult = await databases.listDocuments(DB, "workers", [
    Query.equal("branch_id", branchId),
    Query.equal("activo", true),
    Query.limit(200),
  ]);
  const workers = workersResult.documents as unknown as Worker[];

  if (workers.length === 0) {
    throw new Error("La sucursal no tiene trabajadores activos.");
  }

  const holidaysResult = await databases.listDocuments(DB, "holidays", [
    Query.equal("anio", year),
    Query.limit(50),
  ]);
  const holidays = (holidaysResult.documents as unknown as Array<{ fecha: string }>).map((h) =>
    h.fecha.slice(0, 10)
  );

  const rotation_group = deriveRotationGroup(workers, branch);
  const shiftCatalogV2 = await getShiftsForGroup(rotation_group);
  const shift_catalog = shiftCatalogV2.map(toShiftDef);

  if (shift_catalog.length === 0) {
    throw new Error(`No hay turnos configurados para rotation_group ${rotation_group}.`);
  }

  return {
    branch: {
      id: branchId,
      codigo_area: branch.codigo_area,
      nombre: branch.nombre,
      tipo_franja: branch.tipo_franja,
    },
    rotation_group,
    month: { year, month },
    workers: buildWorkersForPayload(workers),
    holidays,
    shift_catalog,
    franja_por_dia: buildFranjaPorDia(shift_catalog),
    carryover_horas: {},
    parametros: {
      modo: "ilp",
      num_propuestas: 3,
    },
  };
}
