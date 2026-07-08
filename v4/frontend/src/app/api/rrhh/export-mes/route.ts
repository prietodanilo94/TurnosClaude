import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { rrhhRowsFromTeam, buildRrhhWorkbookBufferSheets, safeFileName } from "@/lib/excel/rrhhSheet";
import type { CalendarSlot } from "@/types";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// F10 fase 8 — descarga de Exportar Masivo: un mes explicito, opcionalmente
// filtrado por sucursales. SOLO LECTURA a proposito: no marca
// lastExportedAt ni ChangeExportRecord (esta vista es una "foto"; el
// tracking de descargas vive en Exportar Historial).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") ?? "", 10);
  const month = parseInt(sp.get("month") ?? "", 10);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }
  const branchIds = (sp.get("branchIds") ?? "").split(",").filter(Boolean);

  const calendars = await prisma.calendar.findMany({
    where: {
      year, month,
      ...(branchIds.length > 0 ? { branchTeam: { branchId: { in: branchIds } } } : {}),
    },
    include: { branchTeam: { include: { workers: { where: { activo: true } } } } },
  });

  const rows: (string | number)[][] = [];
  for (const cal of calendars) {
    let slots: CalendarSlot[]; let assignments: Record<string, string | null>;
    try {
      slots = JSON.parse(cal.slotsData);
      assignments = JSON.parse(cal.assignments);
    } catch { continue; }
    const workerRutMap = Object.fromEntries(cal.branchTeam.workers.map((w) => [w.id, w.rut]));
    rows.push(...rrhhRowsFromTeam(year, month, slots, assignments, workerRutMap));
  }

  const buf = buildRrhhWorkbookBufferSheets([{ name: `${MESES[month]} ${year}`, rows }]);
  const fileName = safeFileName(`exportar_masivo_${MESES[month]}_${year}`) + ".xlsx";
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
