import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import * as XLSX from "xlsx";
import { ACTION_LABELS, fmtDetail, parseMetadata } from "@/lib/audit/format";

const MAX_ROWS = 20000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || undefined;
  const supervisorId = searchParams.get("supervisorId") || undefined;
  const action = searchParams.get("action") || undefined;
  const user = searchParams.get("user") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const visto = searchParams.get("visto") || "all"; // all | si | no

  let branchIdsForSupervisor: string[] | undefined;
  if (supervisorId) {
    const links = await prisma.supervisorBranch.findMany({
      where: { supervisorId },
      select: { branchId: true },
    });
    branchIdsForSupervisor = links.map((l) => l.branchId);
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      branchId: branchIdsForSupervisor ? { in: branchIdsForSupervisor } : branchId,
      action: action ? { contains: action } : undefined,
      userEmail: user ? { contains: user } : undefined,
      createdAt: {
        gte: from ? new Date(`${from}T00:00:00`) : undefined,
        lte: to ? new Date(`${to}T23:59:59`) : undefined,
      },
      visto: visto === "si" ? true : visto === "no" ? false : undefined,
    },
    include: { branch: { select: { nombre: true, codigo: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const header = ["Fecha", "Usuario", "Rol", "Acción", "Sucursal", "Código", "Detalle", "Revisado"];
  const rows: (string | number)[][] = [header];

  for (const log of logs) {
    const metadata = parseMetadata(log.metadata);
    rows.push([
      log.createdAt.toLocaleString("es-CL", { timeZone: "America/Santiago" }),
      log.userEmail ?? "Sistema",
      log.userRole ?? "—",
      ACTION_LABELS[log.action] ?? log.action,
      log.branch?.nombre ?? "—",
      log.branch?.codigo ?? "",
      fmtDetail(metadata, log.action),
      log.visto ? "Sí" : "No",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 }, { wch: 30 }, { wch: 11 }, { wch: 24 },
    { wch: 28 }, { wch: 8 }, { wch: 60 }, { wch: 9 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Historial");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const rango = from || to ? `_${from ?? "inicio"}_a_${to ?? "hoy"}` : "";
  const fileName = `historial${rango}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
