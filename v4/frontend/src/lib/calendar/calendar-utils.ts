import type { DayShift } from "@/types";

// Devuelve índice de día de la semana: Lun=0 ... Dom=6
export function dowIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// Formato YYYY-MM-DD
export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Feriados que no pueden ser trabajados (art. 35 bis Código del Trabajo)
export const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1], [5, 1], [9, 18], [9, 19], [12, 25],
];

export function isFeriadoIrrenunciable(d: Date): boolean {
  return FERIADOS_IRRENUNCIABLES.some(
    ([m, day]) => d.getMonth() + 1 === m && d.getDate() === day,
  );
}

// Duración neta de un turno en horas (descuenta 1h de colación si el turno >= 6h)
export function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

// Número de semana ISO (1–53) de una fecha
export function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNr + 3);
  const firstThursday = t.valueOf();
  t.setUTCMonth(0, 1);
  if (t.getUTCDay() !== 4) t.setUTCMonth(0, 1 + ((4 - t.getUTCDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - t.valueOf()) / 604800000);
}

// Construye semanas (Lun-Dom) que cubren el mes indicado
export function buildIsoWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1);
  const last  = new Date(year, month, 0);
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
