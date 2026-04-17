import type { CalendarAssignment } from "@/types/optimizer";

export interface ShiftLike {
  id: string;
  duracion_minutos: number;
}

// { workerRut -> { isoWeek -> horas } }
export type HoursMap = Record<string, Record<number, number>>;

/**
 * Devuelve el número de semana ISO (1-53) para una fecha "YYYY-MM-DD".
 * Semana ISO: lunes es el primer día; la semana 1 contiene el primer jueves del año.
 */
export function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getUTCDay() || 7;        // dom=7 en vez de 0
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // jueves de la misma semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Calcula las horas trabajadas por trabajador por semana ISO.
 *
 * @param assignments - Asignaciones actuales del calendario.
 * @param shifts      - Catálogo de turnos (necesita `id` y `duracion_minutos`).
 * @returns HoursMap: { workerRut -> { isoWeek -> horas } }
 */
export function calculateHours(
  assignments: CalendarAssignment[],
  shifts: ShiftLike[]
): HoursMap {
  const shiftMinutes: Record<string, number> = {};
  for (const s of shifts) {
    shiftMinutes[s.id] = s.duracion_minutos;
  }

  const result: HoursMap = {};

  for (const a of assignments) {
    const minutes = shiftMinutes[a.shift_id] ?? 0;
    const hours = minutes / 60;
    const week = isoWeek(a.date);

    if (!result[a.worker_rut]) result[a.worker_rut] = {};
    result[a.worker_rut][week] = (result[a.worker_rut][week] ?? 0) + hours;
  }

  return result;
}

/**
 * Total de horas en el mes por trabajador.
 */
export function totalMonthlyHours(hoursMap: HoursMap): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [rut, weeks] of Object.entries(hoursMap)) {
    totals[rut] = Object.values(weeks).reduce((s, h) => s + h, 0);
  }
  return totals;
}
