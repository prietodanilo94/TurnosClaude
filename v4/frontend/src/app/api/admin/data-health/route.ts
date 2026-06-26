import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/data-health
 * Reporte de salud de datos maestros para F7/Fase 4.
 * Retorna listas de entidades incompletas para que el admin pueda corregirlas.
 */
export async function GET() {
  const [
    supervisoresSinEmail,
    supervisoresSinPassword,
    supervisoresSinSucursales,
    sucursalesSinEquipo,
    equiposSinCategoria,
    equiposSinVendedores,
    grupos,
    calendariosSinAsignaciones,
  ] = await Promise.all([
    // Supervisores activos sin email configurado
    prisma.supervisor.findMany({
      where: { activo: true, email: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),

    // Supervisores activos con email pero sin password (nunca han hecho login)
    prisma.supervisor.findMany({
      where: { activo: true, email: { not: null }, passwordHash: null },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    }),

    // Supervisores activos sin sucursales asignadas
    prisma.supervisor.findMany({
      where: { activo: true, branches: { none: {} } },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    }),

    // Sucursales sin ningún equipo (BranchTeam)
    prisma.branch.findMany({
      where: { teams: { none: {} } },
      select: { id: true, nombre: true, codigo: true },
      orderBy: { nombre: "asc" },
    }),

    // Equipos sin categoría asignada
    prisma.branchTeam.findMany({
      where: { categoria: null },
      select: {
        id: true,
        areaNegocio: true,
        branch: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { branch: { nombre: "asc" } },
    }),

    // Equipos sin vendedores activos
    prisma.branchTeam.findMany({
      where: { workers: { none: { activo: true, esVirtual: false } } },
      select: {
        id: true,
        areaNegocio: true,
        categoria: true,
        branch: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { branch: { nombre: "asc" } },
    }),

    // Grupos con sus equipos y categorías (para detectar inconsistencias)
    prisma.branchGroup.findMany({
      include: {
        branches: {
          include: {
            teams: { select: { id: true, areaNegocio: true, categoria: true } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),

    // Calendarios con assignedCount = 0 (sin asignaciones)
    prisma.calendar.findMany({
      where: { assignedCount: 0 },
      select: {
        id: true,
        year: true,
        month: true,
        branchTeam: {
          select: {
            areaNegocio: true,
            branch: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 50,
    }),
  ]);

  // Detectar grupos con categorías inconsistentes entre sus equipos del mismo areaNegocio
  const gruposInconsistentes = grupos
    .map((g) => {
      const allTeams = g.branches.flatMap((b) => b.teams);
      const byArea = new Map<string, (string | null)[]>();
      for (const t of allTeams) {
        const cats = byArea.get(t.areaNegocio) ?? [];
        cats.push(t.categoria);
        byArea.set(t.areaNegocio, cats);
      }
      const inconsistencias: string[] = [];
      for (const [area, cats] of byArea.entries()) {
        const unique = new Set(cats.filter(Boolean));
        if (unique.size > 1) {
          inconsistencias.push(`${area}: ${[...unique].join(", ")}`);
        }
      }
      if (inconsistencias.length === 0) return null;
      return {
        id: g.id,
        nombre: g.nombre,
        sucursales: g.branches.map((b) => b.nombre),
        inconsistencias,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    supervisoresSinEmail: supervisoresSinEmail.map((s) => ({ id: s.id, nombre: s.nombre })),
    supervisoresSinPassword: supervisoresSinPassword.map((s) => ({ id: s.id, nombre: s.nombre, email: s.email })),
    supervisoresSinSucursales: supervisoresSinSucursales.map((s) => ({ id: s.id, nombre: s.nombre, email: s.email })),
    sucursalesSinEquipo: sucursalesSinEquipo.map((b) => ({ id: b.id, nombre: b.nombre, codigo: b.codigo })),
    equiposSinCategoria: equiposSinCategoria.map((t) => ({
      id: t.id,
      areaNegocio: t.areaNegocio,
      branchId: t.branch.id,
      branchNombre: t.branch.nombre,
      branchCodigo: t.branch.codigo,
    })),
    equiposSinVendedores: equiposSinVendedores.map((t) => ({
      id: t.id,
      areaNegocio: t.areaNegocio,
      categoria: t.categoria,
      branchId: t.branch.id,
      branchNombre: t.branch.nombre,
      branchCodigo: t.branch.codigo,
    })),
    gruposInconsistentes,
    calendariosSinAsignaciones: calendariosSinAsignaciones.map((c) => ({
      id: c.id,
      year: c.year,
      month: c.month,
      areaNegocio: c.branchTeam.areaNegocio,
      branchId: c.branchTeam.branch.id,
      branchNombre: c.branchTeam.branch.nombre,
    })),
    resumen: {
      supervisoresSinEmail: supervisoresSinEmail.length,
      supervisoresSinPassword: supervisoresSinPassword.length,
      supervisoresSinSucursales: supervisoresSinSucursales.length,
      sucursalesSinEquipo: sucursalesSinEquipo.length,
      equiposSinCategoria: equiposSinCategoria.length,
      equiposSinVendedores: equiposSinVendedores.length,
      gruposInconsistentes: gruposInconsistentes.length,
      calendariosSinAsignaciones: calendariosSinAsignaciones.length,
    },
  });
}
