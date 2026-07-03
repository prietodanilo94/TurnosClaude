import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { buildCambioRows, type WorkerInfoInput } from "@/lib/rrhh/cambiosData";

// F10 fase 5 — historial personal de UN trabajador: todos sus eventos de
// cambio (misma fuente que la tabla principal), sin ventana de fecha porque
// se pide bajo demanda (clic en la ficha del trabajador), no en cada carga
// de pagina.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) {
    return NextResponse.json({ error: "Falta workerId" }, { status: 400 });
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      branchTeam: { select: { areaNegocio: true, branch: { select: { nombre: true, codigo: true } } } },
    },
  });
  if (!worker) {
    return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { action: "calendar.save" },
    select: { id: true, createdAt: true, userEmail: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });

  const exportRecords = await prisma.changeExportRecord.findMany({
    where: { workerId },
    select: { auditLogId: true, workerId: true, exportedAt: true, exportedBy: true },
  });

  const workerInfoMap = new Map<string, WorkerInfoInput>([
    [workerId, {
      areaNegocio: worker.branchTeam.areaNegocio,
      branchNombre: worker.branchTeam.branch.nombre,
      branchCodigo: worker.branchTeam.branch.codigo,
    }],
  ]);

  const rows = buildCambioRows(logs, workerInfoMap, exportRecords).filter((r) => r.workerId === workerId);

  return NextResponse.json({ rows });
}
