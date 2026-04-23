import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";
import { getShiftDurationMinutes } from "./shift-utils";

export type ShiftLike = Pick<
  ShiftDef,
  "id" | "horario_por_dia" | "descuenta_colacion" | "dias_aplicables"
>;

export type HoursMap = Record<string, Record<number, number>>;

export function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function calculateHours(
  assignments: CalendarAssignment[],
  shifts: ShiftLike[]
): HoursMap {
  const shiftById: Record<string, ShiftLike> = {};
  for (const s of shifts) {
    shiftById[s.id] = s;
  }

  const result: HoursMap = {};

  for (const a of assignments) {
    const minutes = getShiftDurationMinutes(shiftById[a.shift_id], a.date);
    const hours = minutes / 60;
    const week = isoWeek(a.date);

    if (!result[a.worker_rut]) result[a.worker_rut] = {};
    result[a.worker_rut][week] = (result[a.worker_rut][week] ?? 0) + hours;
  }

  return result;
}

export function totalMonthlyHours(hoursMap: HoursMap): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [rut, weeks] of Object.entries(hoursMap)) {
    totals[rut] = Object.values(weeks).reduce((sum, hours) => sum + hours, 0);
  }
  return totals;
}
