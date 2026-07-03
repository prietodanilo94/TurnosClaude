import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { buildCambioRows, extractWorkerIdsFromLogs, type WorkerInfoInput } from "@/lib/rrhh/cambiosData";
import ExportarHistorialClient from "./ExportarHistorialClient";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 90;

interface Props {
  searchParams: { from?: string };
}

export default async function ExportarHistorialPage({ searchParams }: Props) {
  await getSession();

  const windowStart = searchParams.from
    ? new Date(`${searchParams.from}T00:00:00`)
    : new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const logs = await prisma.auditLog.findMany({
    where: { action: "calendar.save", createdAt: { gte: windowStart } },
    select: { id: true, createdAt: true, userEmail: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });

  const workerIds = [...extractWorkerIdsFromLogs(logs)];

  const workers = workerIds.length > 0
    ? await prisma.worker.findMany({
        where: { id: { in: workerIds } },
        select: {
          id: true,
          branchTeam: {
            select: { areaNegocio: true, branch: { select: { nombre: true, codigo: true } } },
          },
        },
      })
    : [];

  const workerInfoMap = new Map<string, WorkerInfoInput>(
    workers.map((w) => [
      w.id,
      {
        areaNegocio: w.branchTeam.areaNegocio,
        branchNombre: w.branchTeam.branch.nombre,
        branchCodigo: w.branchTeam.branch.codigo,
      },
    ]),
  );

  const auditLogIds = logs.map((l) => l.id);
  const exportRecords = auditLogIds.length > 0
    ? await prisma.changeExportRecord.findMany({
        where: { auditLogId: { in: auditLogIds } },
        select: { auditLogId: true, workerId: true, exportedAt: true, exportedBy: true },
      })
    : [];

  const rows = buildCambioRows(logs, workerInfoMap, exportRecords);

  return (
    <ExportarHistorialClient
      rows={rows}
      windowFrom={windowStart.toISOString().slice(0, 10)}
      windowDays={DEFAULT_WINDOW_DAYS}
    />
  );
}
