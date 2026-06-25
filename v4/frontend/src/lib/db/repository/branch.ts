import { prisma } from "@/lib/db/prisma";

/**
 * Sucursal con sus equipos (ventas + postventa).
 * Orden canónico: nombre asc — mismo orden que el auto-assign del generador.
 */
export async function getBranchWithTeams(branchId: string) {
  return prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      teams: {
        include: {
          workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
        },
        orderBy: { areaNegocio: "asc" },
      },
    },
  });
}

/**
 * Lista de sucursales asignadas a un supervisor (por supervisorId).
 * Incluye equipos con conteo de workers activos.
 */
export async function getBranchesBySupervisor(supervisorId: string) {
  return prisma.branch.findMany({
    where: {
      supervisors: { some: { supervisorId } },
    },
    include: {
      teams: {
        select: {
          id: true,
          areaNegocio: true,
          categoria: true,
          _count: { select: { workers: { where: { activo: true } } } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });
}

/**
 * Lista completa de sucursales (uso admin). Incluye grupo si tiene.
 */
export async function getAllBranches() {
  return prisma.branch.findMany({
    include: {
      group: { select: { id: true, nombre: true } },
      teams: {
        select: {
          id: true,
          areaNegocio: true,
          categoria: true,
          _count: { select: { workers: { where: { activo: true } } } },
        },
        orderBy: { areaNegocio: "asc" },
      },
    },
    orderBy: { nombre: "asc" },
  });
}
