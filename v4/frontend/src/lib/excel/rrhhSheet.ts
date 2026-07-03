// Formato RRHH compartido: columna RUT (sin DV) + DIA1..DIA31, turno como
// "HH:MM a HH:MM" o celda vacia si libre. Usado por export/export-group/
// export-masivo/export-delta y por la descarga selectiva de F10.
import * as XLSX from "xlsx";
import type { CalendarSlot, DayShift } from "@/types";

export function rutSinDV(rut: string): string {
  return rut.split("-")[0];
}

export function buildRrhhRow(rut: string, year: number, month: number, days: Record<string, DayShift | null>): (string | number)[] {
  const row: (string | number)[] = [rutSinDV(rut)];
  for (let d = 1; d <= 31; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const shift = days[dateStr] ?? null;
    row.push(shift ? `${shift.start} a ${shift.end}` : "");
  }
  return row;
}

// Extrae, para un equipo (slots + assignments), la fila RRHH de cada worker
// asignado que este en `workerIds` (o de todos si no se pasa el filtro).
export function rrhhRowsFromTeam(
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  workerRutMap: Record<string, string>,
  workerIds?: Set<string>,
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId) continue;
    if (workerIds && !workerIds.has(workerId)) continue;
    const rut = workerRutMap[workerId];
    if (!rut) continue;
    rows.push(buildRrhhRow(rut, year, month, slot.days as Record<string, DayShift | null>));
  }
  return rows;
}

export function buildRrhhWorkbookBuffer(rows: (string | number)[][], sheetName = "Turnos RRHH"): Buffer {
  const header: string[] = ["RUT"];
  for (let d = 1; d <= 31; d++) header.push(`DIA${d}`);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 12 }, ...Array(31).fill({ wch: 14 })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}
