import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import SucursalesClient from "./SucursalesClient";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  await getSession();

  const [branches, groups] = await Promise.all([
    prisma.branch.findMany({
      include: {
        teams: {
          include: { _count: { select: { workers: { where: { activo: true } } } } },
        },
        supervisors: { select: { supervisor: { select: { id: true, nombre: true } } } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.branchGroup.findMany({
      include: {
        branches: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            supervisors: { select: { supervisor: { select: { id: true, nombre: true } } } },
          },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const dbPatterns = await prisma.shiftPattern.findMany({ orderBy: { createdAt: "asc" } });
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const savedCalendars = await prisma.calendar.findMany({
    where: { year, month },
    select: { branchTeamId: true, assignedCount: true },
  });
  const calendarStatus: Record<string, "listo" | "vacio"> = Object.fromEntries(
    savedCalendars.map((c) => [c.branchTeamId, c.assignedCount > 0 ? ("listo" as const) : ("vacio" as const)])
  );

  const branchData = branches.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    codigo: b.codigo,
    supervisors: b.supervisors.map((s) => ({ id: s.supervisor.id, nombre: s.supervisor.nombre })),
    teams: b.teams.map((t) => ({
      id: t.id,
      areaNegocio: t.areaNegocio,
      categoria: t.categoria,
      workerCount: t._count.workers,
    })),
  }));

  const groupData = groups.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    branches: g.branches.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      codigo: b.codigo,
      supervisors: b.supervisors.map((s) => ({ id: s.supervisor.id, nombre: s.supervisor.nombre })),
    })),
  }));

  const patternData = dbPatterns.map((p) => ({ id: p.id, label: p.label, areaNegocio: p.areaNegocio }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {branches.length} sucursal{branches.length !== 1 ? "es" : ""}
          {groups.length > 0 && ` · ${groups.length} grupo${groups.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No hay sucursales cargadas aún.</p>
          <Link href="/admin/dotacion" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Subir dotación →
          </Link>
        </div>
      ) : (
        <SucursalesClient
          branches={branchData}
          groups={groupData}
          allPatterns={patternData}
          year={year}
          month={month}
          calendarStatus={calendarStatus}
        />
      )}
    </div>
  );
}
