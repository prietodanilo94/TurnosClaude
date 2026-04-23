import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { ParsedRow } from "./excel-parser";
import type { Branch, Worker, Clasificacion, TipoFranja } from "@/types/models";
import { lookupArea } from "./area-catalog";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export interface BranchDiffInfo {
  codigoArea: string;
  nombre: string;
  isNew: boolean;
  branchId?: string;
  tipoFranja?: TipoFranja;
  clasificacion?: Clasificacion;
  workerCount: number;
}

export type WorkerSyncStatus = "nuevo" | "actualizado" | "sin_cambios";

export interface WorkerDiffInfo {
  row: ParsedRow;
  status: WorkerSyncStatus;
  workerId?: string;
  changes?: string[];
  autoRotationGroup?: string;
}

export interface DotacionDiff {
  branches: BranchDiffInfo[];
  workers: WorkerDiffInfo[];
  toDeactivate: Worker[];
}

async function fetchAll<T extends { $id: string }>(
  collection: string,
  queries: string[] = []
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;

  do {
    const q = [...queries, Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));

    const page = await databases.listDocuments(DB, collection, q);
    all.push(...(page.documents as unknown as T[]));
    cursor = page.documents.length === 100 ? page.documents.at(-1)!.$id : undefined;
  } while (cursor);

  return all;
}

export function computeDotacionDiff(
  rows: ParsedRow[],
  currentBranches: Branch[],
  currentWorkers: Worker[] // Todos los activos
): DotacionDiff {
  // Mapas actuales
  const branchByCode = new Map(currentBranches.map((b) => [b.codigo_area, b]));
  const workerByRut = new Map(currentWorkers.map((w) => [w.rut, w]));

  const branchDiffs = new Map<string, BranchDiffInfo>();
  const workerDiffs: WorkerDiffInfo[] = [];

  for (const row of rows) {
    // 1. Resolver sucursal
    let branchInfo = branchDiffs.get(row.codigoArea);
    if (!branchInfo) {
      const existingBranch = branchByCode.get(row.codigoArea);
      if (existingBranch) {
        branchInfo = {
          codigoArea: row.codigoArea,
          nombre: row.nombreSucursal,
          isNew: false,
          branchId: existingBranch.$id,
          tipoFranja: existingBranch.tipo_franja,
          clasificacion: existingBranch.clasificacion,
          workerCount: 0,
        };
      } else {
        // Auto-clasificación usando area-catalog
        const catValue = lookupArea(row.codigoArea);
        branchInfo = {
          codigoArea: row.codigoArea,
          nombre: row.nombreSucursal,
          isNew: true,
          tipoFranja: catValue?.tipo_franja,
          clasificacion: catValue?.clasificacion,
          workerCount: 0,
        };
      }
      branchDiffs.set(row.codigoArea, branchInfo);
    }
    branchInfo.workerCount++;

    // 2. Resolver trabajador
    const existing = workerByRut.get(row.rut);
    if (!existing) {
      workerDiffs.push({ row, status: "nuevo" });
    } else {
      const changes: string[] = [];
      if (existing.nombre_completo !== row.nombre) changes.push("nombre");
      
      const existingBranchCode = currentBranches.find((b) => b.$id === existing.branch_id)?.codigo_area;
      if (existingBranchCode !== row.codigoArea) changes.push("sucursal");

      if (existing.area_negocio !== row.areaNegocio) changes.push("area_negocio");
      if ((existing.supervisor_nombre || "") !== row.supervisor) changes.push("supervisor");

      if (changes.length > 0) {
        workerDiffs.push({
          row,
          status: "actualizado",
          workerId: existing.$id,
          changes,
        });
      } else {
        workerDiffs.push({
          row,
          status: "sin_cambios",
          workerId: existing.$id,
        });
      }
    }
  }

  // 3. Trabajadores a desactivar (estaban en Appwrite pero no en el Excel)
  const excelRuts = new Set(rows.map((r) => r.rut));
  const toDeactivate = currentWorkers.filter((w) => !excelRuts.has(w.rut));

  return {
    branches: Array.from(branchDiffs.values()),
    workers: workerDiffs,
    toDeactivate,
  };
}

export async function computeDiff(rows: ParsedRow[]): Promise<DotacionDiff> {
  const [branches, workers] = await Promise.all([
    fetchAll<Branch>("branches"),
    fetchAll<Worker>("workers"),
  ]);

  return computeDotacionDiff(
    rows,
    branches.filter((branch) => branch.activa),
    workers.filter((worker) => worker.activo)
  );
}
