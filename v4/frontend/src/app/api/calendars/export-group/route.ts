import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { logAction } from "@/lib/audit/log";
import type { CalendarSlot, DayShift, ShiftCategory } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

function safeSheetName(value: string): string {
  return safeFileName(value).slice(0, 31) || "Calendario";
}

function rutSinDV(rut: string): string {
  return rut.split("-")[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamIds = (searchParams.get("teamIds") ?? "").split(",").filter(Boolean);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const mode = searchParams.get("mode") ?? "calendar";
  const scopeLabel = searchParams.get("scopeLabel") ?? "grupo";
  const scopeType = searchParams.get("scopeType") ?? (teamIds.length > 1 ? "group" : "branch");

  if (teamIds.length === 0 || !year || !month) {
    return NextResponse.json({ error: "Faltan datos para exportar" }, { status: 400 });
  }

  const teams = await prisma.branchTeam.findMany({
    where: { id: { in: teamIds } },
    include: {
      branch: true,
      workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
      calendars: { where: { year, month } },
    },
    orderBy: [{ branch: { nombre: "asc" } }, { areaNegocio: "asc" }],
  });

  if (teams.length === 0) {
    return NextResponse.json({ error: "No se encontraron equipos para exportar" }, { status: 404 });
  }

  const wb = XLSX.utils.book_new();
  let exportedSheets = 0;

  for (const team of teams) {
    const existing = team.calendars[0];
    if (!existing && !team.categoria) continue;

    const slots: CalendarSlot[] = existing
      ? JSON.parse(existing.slotsData)
      : generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length).slots;
    const assignments: Record<string, string | null> = existing ? JSON.parse(existing.assignments) : {};
    const workerMap = Object.fromEntries(team.workers.map((worker) => [worker.id, worker.nombre]));
    const workerRutMap = Object.fromEntries(team.workers.map((worker) => [worker.id, worker.rut]));

    const sheetName = safeSheetName(`${team.branch.nombre}_${team.areaNegocio}`);
    const ws = mode === "rrhh"
      ? buildRrhhSheet(year, month, slots, assignments, workerRutMap)
      : buildCalendarSheet(team.branch.nombre, year, month, slots, assignments, workerMap);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    exportedSheets++;
  }

  if (exportedSheets === 0) {
    return NextResponse.json({ error: "No hay calendarios exportables para este grupo" }, { status: 400 });
  }

  await logAction({
    action: "calendar.export",
    entityType: "calendar",
    entityId: null,
    branchId: teams[0].branchId,
    metadata: {
      teamIds,
      year,
      month,
      mode,
      scopeLabel,
      scopeType,
      sheetCount: exportedSheets,
    },
    req,
  });

  const prefix = mode === "rrhh" ? "turnos_rrhh" : "calendario";
  const fileName = safeFileName(`${prefix}_${scopeLabel}_${MONTH_NAMES[month]}_${year}`) + ".xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}

function buildCalendarSheet(
  branchName: string,
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerMap: Record<string, string>,
): XLSX.WorkSheet {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: (string | number)[][] = [
    [`${branchName} - ${MONTH_NAMES[month]} ${year}`],
    ["Vendedor", ...Array.from({ length: daysInMonth }, (_, index) => String(index + 1).padStart(2, "0"))],
  ];

  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    const workerName = workerId ? workerMap[workerId] ?? `Vendedor ${slot.slotNumber}` : `Vendedor ${slot.slotNumber}`;
    const row: string[] = [workerName];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const shift: DayShift | null = slot.days[dateStr] ?? null;
      row.push(shift ? `${shift.start}-${shift.end}` : "");
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, ...Array(daysInMonth).fill({ wch: 10 })];
  return ws;
}

function buildRrhhSheet(
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerRutMap: Record<string, string>,
): XLSX.WorkSheet {
  const header: string[] = ["RUT"];
  for (let day = 1; day <= 31; day++) header.push(`DIA${day}`);

  const rows: (string | number)[][] = [header];
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId) continue;

    const rut = workerRutMap[workerId] ? rutSinDV(workerRutMap[workerId]) : "";
    if (!rut) continue;

    const row: string[] = [rut];
    for (let day = 1; day <= 31; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const shift: DayShift | null = slot.days[dateStr] ?? null;
      row.push(shift ? `${shift.start} a ${shift.end}` : "");
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, ...Array(31).fill({ wch: 14 })];
  return ws;
}
