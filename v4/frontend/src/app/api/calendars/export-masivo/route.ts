import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import * as XLSX from "xlsx";
import type { CalendarSlot, DayShift } from "@/types";

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

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")!);
  const month = parseInt(searchParams.get("month")!);

  if (!year || !month) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }

  const excludeTeams   = new Set((searchParams.get("excludeTeams")  ?? "").split(",").filter(Boolean));
  const excludeWorkers = new Set((searchParams.get("excludeWorkers") ?? "").split(",").filter(Boolean));

  const calendars = await prisma.calendar.findMany({
    where: { year, month },
    include: {
      branchTeam: {
        include: {
          workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
        },
      },
    },
  });

  const header: string[] = ["RUT"];
  for (let d = 1; d <= 31; d++) header.push(`DIA${d}`);

  const rows: (string | number)[][] = [header];
  const includedCalendarIds: string[] = [];

  for (const cal of calendars) {
    if (excludeTeams.has(cal.branchTeamId)) continue;
    includedCalendarIds.push(cal.id);

    const slots: CalendarSlot[] = JSON.parse(cal.slotsData);
    const assignments: Record<string, string | null> = JSON.parse(cal.assignments);
    const workerRutMap = Object.fromEntries(cal.branchTeam.workers.map((w) => [w.id, w.rut]));

    for (const slot of slots) {
      const workerId = assignments[String(slot.slotNumber)] ?? null;
      if (!workerId) continue;
      if (excludeWorkers.has(workerId)) continue;
      const rut = workerRutMap[workerId] ? rutSinDV(workerRutMap[workerId]) : "";
      if (!rut) continue;

      const row: (string | number)[] = [rut];
      for (let d = 1; d <= 31; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const shift: DayShift | null = (slot.days as Record<string, DayShift | null>)[dateStr] ?? null;
        row.push(shift ? `${shift.start} a ${shift.end}` : "");
      }
      rows.push(row);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, ...Array(31).fill({ wch: 14 })];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Turnos RRHH");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  if (includedCalendarIds.length > 0) {
    await prisma.calendar.updateMany({
      where: { id: { in: includedCalendarIds } },
      data: { lastExportedAt: new Date() },
    });
  }

  const fileName = safeFileName(`turnos_rrhh_masivo_${MONTH_NAMES[month]}_${year}`) + ".xlsx";

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
