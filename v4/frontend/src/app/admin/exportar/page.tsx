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
          workers: { where: { activo: true }, select: { id: true } },
        },
      },
    },
    orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { branchTeam: { areaNegocio: "asc" } }],
  });

  const rows = calendars.map((cal) => {
    const assignments: Record<string, string | null> = JSON.parse(cal.assignments);
    const assignedCount = Object.values(assignments).filter(Boolean).length;
    return {
      branchNombre: cal.branchTeam.branch.nombre,
      branchCodigo: cal.branchTeam.branch.codigo,
      areaNegocio: cal.branchTeam.areaNegocio,
      totalWorkers: cal.branchTeam.workers.length,
      assignedCount,
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
