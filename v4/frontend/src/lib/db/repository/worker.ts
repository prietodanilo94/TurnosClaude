import { prisma } from "@/lib/db/prisma";

/**
 * Workers activos de un equipo, ordenados nombre asc (mismo orden del auto-assign).
 */
export async function getActiveWorkersByTeam(branchTeamId: string) {
  return prisma.worker.findMany({
    where: { branchTeamId, activo: true },
    orderBy: { nombre: "asc" },
  });
}

/**
 * Workers activos de una sucursal (todos los equipos).
 */
export async function getActiveWorkersByBranch(branchId: string) {
  return prisma.worker.findMany({
    where: {
      branchTeam: { branchId },
      activo: true,
    },
    include: {
      branchTeam: { select: { areaNegocio: true, categoria: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

/**
 * Bloqueos activos de un worker en un rango de fechas.
 * Usa solapamiento de intervalos: [start, end] ∩ [from, to] ≠ ∅.
 */
export async function getWorkerBlocks(workerId: string, from: Date, to: Date) {
  return prisma.workerBlock.findMany({
    where: {
      workerId,
      startDate: { lte: to },
      endDate:   { gte: from },
    },
    orderBy: { startDate: "asc" },
  });
}

/**
 * Map de workerId → nombre para un conjunto de IDs.
 * Útil para resolver nombres en exports y calendarios sin cargar todos los workers.
 */
export async function getWorkerNameMap(workerIds: string[]): Promise<Record<string, string>> {
  const workers = await prisma.worker.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, nombre: true },
  });
  return Object.fromEntries(workers.map((w) => [w.id, w.nombre]));
}
