import { prisma } from "@/lib/db/prisma";
import type { WorkerRow, AreaNegocio } from "@/types";

export interface DiffNuevo {
  rut: string;
  nombre: string;
  sucursal: string;
  areaNegocio: AreaNegocio;
}

export interface DiffModificado {
  rut: string;
  nombre: string;
  cambios: { campo: "nombre" | "sucursal" | "areaNegocio"; antes: string; ahora: string }[];
}

export interface DiffDesactivar {
  rut: string;
  nombre: string;
  sucursal: string;
  areaNegocio: AreaNegocio;
}

export interface DiffSucursalNueva {
  codigo: string;
  nombre: string;
  vendedoresCount: number;
}

export interface DotacionDiff {
  nuevos: DiffNuevo[];
  modificados: DiffModificado[];
  desactivar: DiffDesactivar[];
  sucursalesNuevas: DiffSucursalNueva[];
  sinCambios: number;
}

export async function computeDotacionDiff(rows: WorkerRow[]): Promise<DotacionDiff> {
  const dbWorkers = await prisma.worker.findMany({
    where: { activo: true },
    include: { branchTeam: { include: { branch: true } } },
  });
  const dbBranches = await prisma.branch.findMany();

  const dbWorkerByRut = new Map(dbWorkers.map((w) => [w.rut, w]));
  const dbBranchByCodigo = new Map(dbBranches.map((b) => [b.codigo, b]));

  const incomingRuts = new Set(rows.map((r) => r.rut));

  const nuevos: DiffNuevo[] = [];
  const modificados: DiffModificado[] = [];
  let sinCambios = 0;

  for (const row of rows) {
    const existing = dbWorkerByRut.get(row.rut);
    if (!existing) {
      nuevos.push({
        rut: row.rut,
        nombre: row.nombre,
        sucursal: row.nombreBranch,
        areaNegocio: row.areaNegocio,
      });
      continue;
    }

    const cambios: DiffModificado["cambios"] = [];
    if (existing.nombre !== row.nombre) {
      cambios.push({ campo: "nombre", antes: existing.nombre, ahora: row.nombre });
    }
    const branchActual = existing.branchTeam.branch;
    if (branchActual.codigo !== row.codigoBranch) {
      cambios.push({
        campo: "sucursal",
        antes: `${branchActual.nombre} (${branchActual.codigo})`,
        ahora: `${row.nombreBranch} (${row.codigoBranch})`,
      });
    }
    if (existing.branchTeam.areaNegocio !== row.areaNegocio) {
      cambios.push({
        campo: "areaNegocio",
        antes: existing.branchTeam.areaNegocio,
        ahora: row.areaNegocio,
      });
    }
    if (cambios.length > 0) {
      modificados.push({ rut: row.rut, nombre: row.nombre, cambios });
    } else {
      sinCambios++;
    }
  }

  const desactivar: DiffDesactivar[] = dbWorkers
    .filter((w) => !incomingRuts.has(w.rut))
    .map((w) => ({
      rut: w.rut,
      nombre: w.nombre,
      sucursal: w.branchTeam.branch.nombre,
      areaNegocio: w.branchTeam.areaNegocio as AreaNegocio,
    }));

  const incomingBranchCodes = new Map<string, { nombre: string; count: number }>();
  for (const row of rows) {
    const existing = incomingBranchCodes.get(row.codigoBranch);
    if (existing) {
      existing.count++;
    } else {
      incomingBranchCodes.set(row.codigoBranch, { nombre: row.nombreBranch, count: 1 });
    }
  }

  const sucursalesNuevas: DiffSucursalNueva[] = [];
  for (const [codigo, info] of incomingBranchCodes) {
    if (!dbBranchByCodigo.has(codigo)) {
      sucursalesNuevas.push({ codigo, nombre: info.nombre, vendedoresCount: info.count });
    }
  }

  return { nuevos, modificados, desactivar, sucursalesNuevas, sinCambios };
}
