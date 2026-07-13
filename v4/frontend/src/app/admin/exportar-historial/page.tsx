import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { buildCambioRows, extractWorkerIdsFromLogs, keepLatestPerWorker, type WorkerInfoInput } from "@/lib/rrhh/cambiosData";
import ExportarHistorialClient from "./ExportarHistorialClient";

export const dynamic = "force-dynamic";

export default async function ExportarHistorialPage() {
  await getSession();

  const logs = await prisma.auditLog.findMany({
    where: { action: "calendar.save" },
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

  // Tabla principal: una fila por trabajador (la mas reciente). El historial
  // completo de cada uno se ve desde /admin/trabajadores -> Historial.
  const rows = keepLatestPerWorker(buildCambioRows(logs, workerInfoMap, exportRecords));

  return <ExportarHistorialClient rows={rows} />;
}
