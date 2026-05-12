import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import type { CalendarSlot, DayShift, ShiftCategory } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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
    ["Vendedor", ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"))],
  ];

  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${slot.slotNumber}`) : `Vendedor ${slot.slotNumber}`;
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

export async function generateGroupCalendarExcel({
  teamIds,
  year,
  month,
  scopeLabel,
}: {
  teamIds: string[];
  year: number;
  month: number;
  scopeLabel?: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const teams = await prisma.branchTeam.findMany({
    where: { id: { in: teamIds } },
    include: {
      branch: true,
      workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
      calendars: { where: { year, month } },
    },
    orderBy: [{ branch: { nombre: "asc" } }, { areaNegocio: "asc" }],
  });

  const wb = XLSX.utils.book_new();

  for (const team of teams) {
    const existing = team.calendars[0];
    if (!existing && !team.categoria) continue;

    const slots: CalendarSlot[] = existing
      ? JSON.parse(existing.slotsData)
      : generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length).slots;
    const assignments: Record<string, string | null> = existing ? JSON.parse(existing.assignments) : {};
    const workerMap = Object.fromEntries(team.workers.map((w) => [w.id, w.nombre]));
    const sheetName = safeSheetName(`${team.branch.nombre}_${team.areaNegocio}`);

    XLSX.utils.book_append_sheet(
      wb,
      buildCalendarSheet(team.branch.nombre, year, month, slots, assignments, workerMap),
      sheetName,
    );
  }

  const label = safeFileName(scopeLabel ?? "grupo");
  const fileName = `calendario_${label}_${MONTH_NAMES[month]}_${year}.xlsx`;
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return { buffer, fileName };
}
