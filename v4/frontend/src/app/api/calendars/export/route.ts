import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import * as XLSX from "xlsx";
import type { CalendarSlot, ShiftCategory, DayShift } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dowIndex(d: Date) { return (d.getDay() + 6) % 7; }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")!;
  const year   = parseInt(searchParams.get("year")!);
  const month  = parseInt(searchParams.get("month")!);
  const mode   = searchParams.get("mode") ?? "slots"; // "slots" | "assigned"

  const team = await prisma.branchTeam.findUnique({
    where: { id: teamId },
    include: {
      branch: true,
      workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
      calendars: { where: { year, month } },
    },
  });
  if (!team || !team.categoria) {
    return NextResponse.json({ error: "Sin datos" }, { status: 404 });
  }

  let slots: CalendarSlot[];
  let assignments: Record<string, string | null> = {};

  const existing = team.calendars[0];
  if (existing) {
    slots = JSON.parse(existing.slotsData);
    assignments = JSON.parse(existing.assignments);
  } else {
    const result = generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length);
    slots = result.slots;
  }

  const workerMap = Object.fromEntries(team.workers.map((w) => [w.id, w.nombre]));

  // ── Construir Excel ───────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const lastDay = new Date(year, month, 0).getDate();

  const header: string[] = ["Trabajador"];
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    header.push(`${DOW_SHORT[dowIndex(date)]} ${d}`);
  }
  header.push("Total días trabajados");

  const wsData: (string | number)[][] = [header];

  for (const slot of slots) {
    const workerName =
      mode === "assigned"
        ? (workerMap[assignments[String(slot.slotNumber)] ?? ""] ?? `Trabajador ${slot.slotNumber}`)
        : `Trabajador ${slot.slotNumber}`;

    const row: (string | number)[] = [workerName];
    let workDays = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const shift: DayShift | null = slot.days[dateStr] ?? null;
      if (shift) {
        row.push(`${shift.start}–${shift.end}`);
        workDays++;
      } else {
        row.push("Libre");
      }
    }
    row.push(workDays);
    wsData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas
  ws["!cols"] = [{ wch: 22 }, ...Array(lastDay).fill({ wch: 12 }), { wch: 8 }];

  const sheetName = mode === "assigned" ? "Turnos Asignados" : "Plantilla Turnos";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fileName = `turnos_${team.branch.nombre}_${MONTH_NAMES[month]}_${year}_${mode}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
