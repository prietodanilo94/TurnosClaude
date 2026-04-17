import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Branch, Worker } from "@/types/models";
import type { ParsedRow, DotacionDiff, WorkerDiff, BranchDiff } from "@/types/dotacion-sync";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

async function fetchAll<T>(collection: string, queries: string[] = []): Promise<T[]> {
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

export async function computeDiff(rows: ParsedRow[]): Promise<DotacionDiff> {
  const [existingBranches, existingWorkers] = await Promise.all([
    fetchAll<Branch>("branches"),
    fetchAll<Worker>("workers"),
  ]);

  const branchByCode = new Map(existingBranches.map((b) => [b.codigo_area, b]));
  const workerByRut  = new Map(existingWorkers.map((w) => [w.rut, w]));

  // ── Branches ──────────────────────────────────────────────────────────────
  const branchDiffMap = new Map<string, BranchDiff>();
  for (const row of rows) {
    if (branchDiffMap.has(row.codigoArea)) {
      branchDiffMap.get(row.codigoArea)!.workerCount++;
      continue;
    }
    const existing = branchByCode.get(row.codigoArea);
    branchDiffMap.set(row.codigoArea, {
      codigoArea: row.codigoArea,
      nombre: row.nombreSucursal,
      isNew: !existing,
      branchId: existing?.$id,
      tipoFranja: existing?.tipo_franja,
      workerCount: 1,
    });
  }

  // ── Workers ───────────────────────────────────────────────────────────────
  const seenRuts = new Set(rows.map((r) => r.rut));
  const workerDiffs: WorkerDiff[] = rows.map((row) => {
    const existing = workerByRut.get(row.rut);
    const branch = branchByCode.get(row.codigoArea);

    if (!existing) {
      return { row, status: "nuevo" };
    }

    // Revisar si hay cambios relevantes
    const changed =
      existing.nombre_completo !== row.nombre ||
      existing.branch_id !== branch?.$id ||
      existing.supervisor_nombre !== row.supervisor ||
      !existing.activo;

    return {
      row,
      status: changed ? "actualizado" : "sin_cambios",
      workerId: existing.$id,
      branchId: existing.branch_id,
    };
  });

  // Trabajadores activos que ya no están en el Excel → soft-delete
  const toDeactivate = existingWorkers
    .filter((w) => w.activo && !seenRuts.has(w.rut))
    .map((w) => ({ workerId: w.$id, rut: w.rut, nombre: w.nombre_completo }));

  return {
    workers: workerDiffs,
    branches: Array.from(branchDiffMap.values()),
    toDeactivate,
  };
}
