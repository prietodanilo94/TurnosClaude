import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { logAction } from "@/lib/audit/log";
import type { CalendarSlot, DayShift, ShiftCategory } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_ABBR = [
  "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

function dowIndex(d: Date) { return (d.getDay() + 6) % 7; }

function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNr + 3);
  const firstThursday = t.valueOf();
  t.setUTCMonth(0, 1);
  if (t.getUTCDay() !== 4) t.setUTCMonth(0, 1 + ((4 - t.getUTCDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - t.valueOf()) / 604800000);
}

function buildIsoWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - dowIndex(first));
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - dowIndex(last)));
  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

function fmtDateRange(d1: Date, d2: Date): string {
  const m1 = MONTH_ABBR[d1.getMonth() + 1];
  const m2 = MONTH_ABBR[d2.getMonth() + 1];
  if (d1.getMonth() === d2.getMonth()) {
    return `${String(d1.getDate()).padStart(2, "0")} – ${String(d2.getDate()).padStart(2, "0")} ${m2}`;
  }
  return `${String(d1.getDate()).padStart(2, "0")} ${m1} – ${String(d2.getDate()).padStart(2, "0")} ${m2}`;
}

const C = {
  TITLE_BG:    "1F4E79",
  TITLE_FG:    "FFFFFF",
  WEEK_BG:     "2E75B6",
  WEEK_FG:     "FFFFFF",
  HDR_BG:      "BDD7EE",
  HDR_FG:      "1F4E79",
  WKND_HDR_BG: "F4B942",
  WKND_HDR_FG: "7B3F00",
  SHIFT_BG:    "E2EFDA",
  SHIFT_FG:    "1A4731",
  WKND_SHIFT:  "FFF2CC",
  WKND_SFG:    "7B4F00",
  LIBRE_FG:    "AAAAAA",
  ALT_BG:      "F7FBFF",
  HOURS_FG:    "1F4E79",
  BORDER:      "D0D7DE",
};

function fill(hex: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } };
}
function border(): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb: `FF${C.BORDER}` } };
  return { top: side, left: side, bottom: side, right: side };
}

function addCalendarSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  branchNombre: string,
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerMap: Record<string, string>,
): void {
  const ws = wb.addWorksheet(sheetName);
  const COLS = 9;

  ws.columns = [
    { width: 26 },
    ...Array(7).fill({ width: 14 }),
    { width: 10 },
  ];

  const titleRow = ws.addRow([`CALENDARIO DE TURNOS  —  ${branchNombre.toUpperCase()}  —  ${MONTH_NAMES[month].toUpperCase()} ${year}`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
  const tc = titleRow.getCell(1);
  tc.fill = fill(C.TITLE_BG);
  tc.font = { bold: true, size: 13, color: { argb: `FF${C.TITLE_FG}` } };
  tc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleRow.height = 22;

  ws.addRow([]);

  const weeks = buildIsoWeeks(year, month);

  for (const week of weeks) {
    const isoWeek = isoWeekNumber(week[0]);

    const weekRow = ws.addRow([`  Sem ${isoWeek}   ${fmtDateRange(week[0], week[6])}`]);
    ws.mergeCells(weekRow.number, 1, weekRow.number, COLS);
    const wc = weekRow.getCell(1);
    wc.fill = fill(C.WEEK_BG);
    wc.font = { bold: true, size: 10, color: { argb: `FF${C.WEEK_FG}` } };
    wc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    weekRow.height = 18;

    const hdrRow = ws.addRow([
      "Vendedor",
      ...week.map((d, ci) => `${DOW_LABELS[ci]} ${String(d.getDate()).padStart(2, "0")}`),
      "Hrs Sem",
    ]);
    hdrRow.height = 16;
    hdrRow.eachCell((cell, col) => {
      const isWknd = col >= 2 && col <= 8 && (col - 2) >= 5;
      cell.fill = fill(isWknd ? C.WKND_HDR_BG : C.HDR_BG);
      cell.font = { bold: true, size: 9, color: { argb: `FF${isWknd ? C.WKND_HDR_FG : C.HDR_FG}` } };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      cell.border = border();
    });

    slots.forEach((slot, si) => {
      const workerId = assignments[String(slot.slotNumber)] ?? null;
      const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${slot.slotNumber}`) : `Vendedor ${slot.slotNumber}`;
      const isAlt = si % 2 === 1;

      let totalH = 0;
      const rowData: (string | number)[] = [workerName];
      const shifts: (DayShift | null)[] = [];
      week.forEach((d) => {
        const dateStr = d.toISOString().slice(0, 10);
        const sh = slot.days[dateStr] ?? null;
        shifts.push(sh);
        if (sh) totalH += shiftDuration(sh);
        rowData.push(sh ? `${sh.start}–${sh.end}` : "libre");
      });
      rowData.push(totalH > 0 ? `${Number.isInteger(totalH) ? totalH : totalH.toFixed(1)}h` : "—");

      const dataRow = ws.addRow(rowData);
      dataRow.height = 15;

      dataRow.eachCell((cell, col) => {
        const isWknd = col >= 2 && col <= 8 && (col - 2) >= 5;
        const shiftIdx = col - 2;
        const sh = shiftIdx >= 0 && shiftIdx < 7 ? shifts[shiftIdx] : null;
        const isLibre = col >= 2 && col <= 8 && sh === null;
        const isHrs = col === COLS;

        if (col === 1) {
          cell.fill = fill(isAlt ? C.ALT_BG : "FFFFFF");
          cell.font = { bold: true, size: 9 };
          cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        } else if (isLibre) {
          cell.fill = fill(isAlt ? "EFEFEF" : "F8F8F8");
          cell.font = { size: 9, color: { argb: `FF${C.LIBRE_FG}` }, italic: true };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (isHrs) {
          cell.fill = fill(isAlt ? C.ALT_BG : "FFFFFF");
          cell.font = { bold: true, size: 9, color: { argb: `FF${C.HOURS_FG}` } };
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (sh) {
          cell.fill = fill(isWknd ? C.WKND_SHIFT : C.SHIFT_BG);
          cell.font = { size: 9, color: { argb: `FF${isWknd ? C.WKND_SFG : C.SHIFT_FG}` } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
        cell.border = border();
      });
    });

    ws.addRow([]);
  }
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

  let buf: Buffer;
  const prefix = mode === "rrhh" ? "turnos_rrhh" : "calendario";
  const fileName = safeFileName(`${prefix}_${scopeLabel}_${MONTH_NAMES[month]}_${year}`) + ".xlsx";

  if (mode === "rrhh") {
    // RRHH mode: plain xlsx (sin colores)
    const wb = XLSX.utils.book_new();
    let exportedSheets = 0;

    for (const team of teams) {
      const existing = team.calendars[0];
      if (!existing && !team.categoria) continue;

      const slots: CalendarSlot[] = existing
        ? JSON.parse(existing.slotsData)
        : generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length).slots;
      const assignments: Record<string, string | null> = existing ? JSON.parse(existing.assignments) : {};
      const workerRutMap = Object.fromEntries(team.workers.map((w) => [w.id, w.rut]));

      const sheetName = safeSheetName(`${team.branch.nombre}_${team.areaNegocio}`);
      const ws = buildRrhhSheet(year, month, slots, assignments, workerRutMap);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      exportedSheets++;
    }

    if (exportedSheets === 0) {
      return NextResponse.json({ error: "No hay calendarios exportables para este grupo" }, { status: 400 });
    }

    buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  } else {
    // Calendar mode: ExcelJS con colores
    const wb = new ExcelJS.Workbook();
    wb.creator = "TeamPlanner";
    let exportedSheets = 0;

    for (const team of teams) {
      const existing = team.calendars[0];
      if (!existing && !team.categoria) continue;

      const slots: CalendarSlot[] = existing
        ? JSON.parse(existing.slotsData)
        : generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length).slots;
      const assignments: Record<string, string | null> = existing ? JSON.parse(existing.assignments) : {};
      const workerMap = Object.fromEntries(team.workers.map((w) => [w.id, w.nombre]));

      const sheetName = safeSheetName(`${team.branch.nombre}_${team.areaNegocio}`);
      addCalendarSheet(wb, sheetName, team.branch.nombre, year, month, slots, assignments, workerMap);
      exportedSheets++;
    }

    if (exportedSheets === 0) {
      return NextResponse.json({ error: "No hay calendarios exportables para este grupo" }, { status: 400 });
    }

    const raw = await wb.xlsx.writeBuffer();
    buf = Buffer.from(raw);
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
      sheetCount: teams.length,
    },
    req,
  });

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
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
