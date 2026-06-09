import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import ExportarClient from "./ExportarClient";

interface Props {
  searchParams: { year?: string; month?: string };
}

export const dynamic = "force-dynamic";

export default async function ExportarPage({ searchParams }: Props) {
  await getSession();

  const now = new Date();
  const year  = Number(searchParams.year  ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const calendars = await prisma.calendar.findMany({
    where: { year, month },
    include: {
      branchTeam: {
        include: {
          branch: { select: { nombre: true, codigo: true } },
          workers: { where: { activo: true }, select: { id: true, nombre: true, rut: true } },
        },
      },
    },
    orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { branchTeam: { areaNegocio: "asc" } }],
  });

  const rows = calendars.map((cal) => {
    // assignments JSON solo se parsea aquí para listar nombres; el conteo viene denormalizado
    const assignments: Record<string, string | null> = JSON.parse(cal.assignments);
    const assignedWorkerIds = new Set(Object.values(assignments).filter(Boolean) as string[]);
    const assignedWorkers = cal.branchTeam.workers
      .filter((w) => assignedWorkerIds.has(w.id))
      .map((w) => ({ id: w.id, nombre: w.nombre, rut: w.rut }));

    return {
      teamId: cal.branchTeamId,
      branchNombre: cal.branchTeam.branch.nombre,
      branchCodigo: cal.branchTeam.branch.codigo,
      areaNegocio: cal.branchTeam.areaNegocio,
      totalWorkers: cal.branchTeam.workers.length,
      assignedCount: cal.assignedCount,
      assignedWorkers,
      lastExportedAt: cal.lastExportedAt?.toISOString() ?? null,
      updatedAt: cal.updatedAt.toISOString(),
    };
  });

  const totalAssigned = rows.reduce((sum, r) => sum + r.assignedCount, 0);

  return (
    <ExportarClient
      year={year}
      month={month}
      rows={rows}
      totalAssigned={totalAssigned}
    />
  );
}
