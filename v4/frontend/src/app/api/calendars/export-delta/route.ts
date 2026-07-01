import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import * as XLSX from "xlsx";
import type { CalendarSlot, DayShift } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function rutSinDV(rut: string): string {
  return rut.split("-")[0];
}

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")!);
  const month = parseInt(searchParams.get("month")!);

  if (!year || !month) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }

  const calendars = await prisma.calendar.findMany({
    where: { year, month },
    include: {
      branchTeam: {
        include: {
          workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
          branch: { select: { id: true } },
        },
      },
    },
  });

  // Solo calendarios modificados desde el último export (o nunca exportados)
  const modified = calendars.filter(
    (c) => !c.lastExportedAt || c.updatedAt > c.lastExportedAt,
  );

  if (modified.length === 0) {
    return NextResponse.json({ error: "No hay cambios desde el último export" }, { status: 404 });
  }

  const header: string[] = ["RUT"];
  for (let d = 1; d <= 31; d++) header.push(`DIA${d}`);
  const rows: (string | number)[][] = [header];
  const includedCalendarIds: string[] = [];

  for (const cal of modified) {
    includedCalendarIds.push(cal.id);
    const slots: CalendarSlot[] = JSON.parse(cal.slotsData);
    const assignments: Record<string, string | null> = JSON.parse(cal.assignments);
    const workerRutMap = Object.fromEntries(cal.branchTeam.workers.map((w) => [w.id, w.rut]));

    // Determinar qué workers exportar
    let workerIdsToExport: Set<string> | null = null;

    if (cal.lastExportedAt) {
      // Calendarios modificados: buscar en audit log los workerIds que cambiaron
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: "calendar.save",
          branchId: cal.branchTeam.branchId,
          createdAt: { gt: cal.lastExportedAt },
        },
        select: { metadata: true },
      });

      const changedIds = new Set<string>();
      for (const log of auditLogs) {
        if (!log.metadata) continue;
        try {
          const meta = JSON.parse(log.metadata) as { changes?: Array<{ workerId?: string }> };
          if (Array.isArray(meta.changes)) {
            for (const c of meta.changes) {
              if (c.workerId) changedIds.add(c.workerId);
            }
          }
        } catch { /* metadata malformado */ }
      }

      // Si hay workerIds en el log, exportar solo esos; si no (datos viejos), exportar todos
      if (changedIds.size > 0) workerIdsToExport = changedIds;
    }
    // cal.lastExportedAt === null → nunca exportado → exportar todos los workers asignados

    for (const slot of slots) {
      const workerId = assignments[String(slot.slotNumber)] ?? null;
      if (!workerId) continue;
      if (workerIdsToExport && !workerIdsToExport.has(workerId)) continue;
      const rut = workerRutMap[workerId] ? rutSinDV(workerRutMap[workerId]) : "";
      if (!rut) continue;

      const row: (string | number)[] = [rut];
      for (let d = 1; d <= 31; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const shift = (slot.days as Record<string, DayShift | null>)[dateStr] ?? null;
        row.push(shift ? `${shift.start} a ${shift.end}` : "");
      }
      rows.push(row);
    }
  }

  if (rows.length <= 1) {
    return NextResponse.json({ error: "No hay cambios desde el último export" }, { status: 404 });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, ...Array(31).fill({ wch: 14 })];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Delta RRHH");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await prisma.calendar.updateMany({
    where: { id: { in: includedCalendarIds } },
    data: { lastExportedAt: new Date() },
  });

  const fileName = safeFileName(`delta_rrhh_${MONTH_NAMES[month]}_${year}`) + ".xlsx";

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
