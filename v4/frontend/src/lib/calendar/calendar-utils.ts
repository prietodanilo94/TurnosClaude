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
