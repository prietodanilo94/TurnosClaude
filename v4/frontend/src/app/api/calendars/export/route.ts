import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { logAction } from "@/lib/audit/log";
import * as XLSX from "xlsx";
import type { CalendarSlot, ShiftCategory, DayShift } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_ABBR = [
  "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dowIndex(d: Date) { return (d.getDay() + 6) % 7; }

function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total; // descuenta 1h colación en turnos ≥ 6h
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

function rutSinDV(rut: string): string {
  return rut.split("-")[0];
}

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId")!;
  const year   = parseInt(searchParams.get("year")!);
  const month  = parseInt(searchParams.get("month")!);
  const mode   = searchParams.get("mode") ?? "calendar"; // "calendar" | "rrhh"

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
  const workerRutMap = Object.fromEntries(team.workers.map((w) => [w.id, w.rut]));

  let buf: Buffer;
  let fileName: string;

  if (mode === "rrhh") {
    buf = buildRrhhExcel(team.branch.nombre, year, month, slots, assignments, workerMap, workerRutMap);
    fileName = safeFileName(`turnos_rrhh_${team.branch.nombre}_${MONTH_NAMES[month]}_${year}`) + ".xlsx";
  } else {
    buf = buildCalendarExcel(team.branch.nombre, year, month, slots, assignments, workerMap);
    fileName = safeFileName(`calendario_${team.branch.nombre}_${MONTH_NAMES[month]}_${year}`) + ".xlsx";
  }

  await logAction({
    action: "calendar.export",
    entityType: "calendar",
    entityId: existing?.id ?? null,
    branchId: team.branch.id,
    metadata: {
      teamId,
      year,
      month,
      mode,
      branchName: team.branch.nombre,
      assignedCount: Object.values(assignments ?? {}).filter(Boolean).length,
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

// ─── Exportar Calendario (visual semanal estilo v1) ───────────────────────────

function buildCalendarExcel(
  branchNombre: string,
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerMap: Record<string, string>,
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const COLS = 9; // Vendedor + 7 días + Hrs Sem
  let row = 1;

  // ── Título ──
  const titleText = `CALENDARIO DE TURNOS  —  ${branchNombre.toUpperCase()}  —  ${MONTH_NAMES[month].toUpperCase()} ${year}`;
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = {
    v: titleText, t: "s",
    s: { font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F4E79" } }, alignment: { horizontal: "left" } },
  };
  ws["!merges"] = ws["!merges"] ?? [];
  ws["!merges"].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } });
  row++;

  row++; // espacio

  const weeks = buildIsoWeeks(year, month);

  for (const week of weeks) {
    const isoWeek = isoWeekNumber(week[0]);
    const weekLabel = `  Sem ${isoWeek}   ${fmtDateRange(week[0], week[6])}`;

    // Cabecera semana
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = {
      v: weekLabel, t: "s",
      s: { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E75B6" } }, alignment: { horizontal: "left" } },
    };
    ws["!merges"].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } });
    row++;

    // Sub-cabecera días
    const headerStyle = { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: "BDD7EE" } }, alignment: { horizontal: "center" } };
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = { v: "Vendedor", t: "s", s: headerStyle };
    week.forEach((d, ci) => {
      const isWknd = ci >= 5;
      const style = { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: isWknd ? "FCE4D6" : "BDD7EE" } }, alignment: { horizontal: "center" } };
      ws[XLSX.utils.encode_cell({ r: row - 1, c: ci + 1 })] = {
        v: `${DOW_LABELS[ci]} ${String(d.getDate()).padStart(2, "0")}`, t: "s", s: style,
      };
    });
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 8 })] = { v: "Hrs Sem", t: "s", s: headerStyle };
    row++;

    // Filas vendedores
    slots.forEach((slot, si) => {
      const workerId = assignments[String(slot.slotNumber)] ?? null;
      const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${slot.slotNumber}`) : `Vendedor ${slot.slotNumber}`;
      const altFill = si % 2 === 1 ? { fgColor: { rgb: "F5F5F5" } } : undefined;

      ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = {
        v: workerName, t: "s",
        s: { font: { bold: true, sz: 9 }, fill: altFill, alignment: { horizontal: "left" } },
      };

      let totalH = 0;
      week.forEach((d, ci) => {
        const dateStr = d.toISOString().slice(0, 10);
        const shift: DayShift | null = slot.days[dateStr] ?? null;
        if (shift) totalH += shiftDuration(shift);
        ws[XLSX.utils.encode_cell({ r: row - 1, c: ci + 1 })] = shift
          ? { v: `${shift.start}–${shift.end}`, t: "s", s: { font: { sz: 9 }, fill: altFill, alignment: { horizontal: "center" } } }
          : { v: "libre", t: "s", s: { font: { sz: 9, color: { rgb: "AAAAAA" }, italic: true }, fill: altFill, alignment: { horizontal: "center" } } };
      });

      ws[XLSX.utils.encode_cell({ r: row - 1, c: 8 })] = {
        v: totalH > 0 ? `${Number.isInteger(totalH) ? totalH : totalH.toFixed(1)}h` : "—", t: "s",
        s: { font: { bold: true, sz: 9 }, fill: altFill, alignment: { horizontal: "right" } },
      };
      row++;
    });

    row++; // separador entre semanas
  }

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: COLS - 1 } });
  ws["!cols"] = [{ wch: 24 }, ...Array(7).fill({ wch: 13 }), { wch: 9 }];

  XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES[month]} ${year}`);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── Exportar Excel RRHH (RUT sin DV, DIA1..DIA31) ───────────────────────────

function buildRrhhExcel(
  branchNombre: string,
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerMap: Record<string, string>,
  workerRutMap: Record<string, string>,
): Buffer {
  // Siempre 31 columnas de días (días inexistentes quedan vacíos)
  const header: string[] = ["RUT"];
  for (let d = 1; d <= 31; d++) header.push(`DIA${d}`);

  const wsData: (string | number)[][] = [header];

  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId) continue;

    const rut = workerRutMap[workerId] ? rutSinDV(workerRutMap[workerId]) : "";
    if (!rut) continue;

    const row: (string | number)[] = [rut];
    for (let d = 1; d <= 31; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const shift: DayShift | null = slot.days[dateStr] ?? null;
      // libre = celda vacía; turno = "HH:MM a HH:MM"
      row.push(shift ? `${shift.start} a ${shift.end}` : "");
    }
    wsData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 12 }, ...Array(31).fill({ wch: 14 })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Turnos RRHH");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
