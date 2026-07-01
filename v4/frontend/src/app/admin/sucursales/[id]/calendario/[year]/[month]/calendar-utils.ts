// Utilidades compartidas del calendario (fechas, formato, semanas rotativas)
import type { CalendarSlot, DayShift, WeekPattern } from "@/types";

export const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MONTH_ABBR = [
  "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function dowIndex(d: Date) { return (d.getDay() + 6) % 7; }
export function fmt(d: Date) { return d.toISOString().slice(0, 10); }

export const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1], [5, 1], [9, 18], [9, 19], [12, 25],
];
export function isFeriadoIrrenunciable(d: Date): boolean {
  return FERIADOS_IRRENUNCIABLES.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

export function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

export function minutesFromTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmtHours(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export function addMinutesToTime(t: string, mins: number): string {
  const total = minutesFromTime(t) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function validateConsecutiveDays(days: Record<string, DayShift | null>): boolean {
  const dates = Object.keys(days).sort();
  let run = 0;
  for (const d of dates) {
    if (days[d] !== null) { run++; if (run > 6) return false; } else { run = 0; }
  }
  return true;
}

export function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function buildIsoWeeks(year: number, month: number): Date[][] {
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

export function fmtDateRange(d1: Date, d2: Date): string {
  if (d1.getMonth() === d2.getMonth()) {
    return `${String(d1.getDate()).padStart(2, "0")} – ${String(d2.getDate()).padStart(2, "0")} ${MONTH_ABBR[d2.getMonth() + 1]}`;
  }
  return `${String(d1.getDate()).padStart(2, "0")} ${MONTH_ABBR[d1.getMonth() + 1]} – ${String(d2.getDate()).padStart(2, "0")} ${MONTH_ABBR[d2.getMonth() + 1]}`;
}

export function shortWorkerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}
export const SEMANA_COLORS = [
  { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300"    },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-300"  },
  { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-300"  },
  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-300"    },
  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-300"   },
] as const;

export function detectSemanaOffset(slot: CalendarSlot, patternRotation: WeekPattern[], year: number, month: number): number {
  const N = patternRotation.length;
  if (N <= 1) return 0;
  let bestSem = 0;
  let bestScore = -1;
  for (let sem = 0; sem < N; sem++) {
    let score = 0; let total = 0;
    for (let d = 1; d <= 7; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!(dateStr in slot.days)) continue;
      const actual = slot.days[dateStr];
      const date = new Date(dateStr + "T12:00:00");
      const dow = (date.getDay() + 6) % 7;
      const expected = patternRotation[sem][dow];
      total++;
      if (actual === null && expected === null) score++;
      else if (actual && expected && actual.start === expected.start && actual.end === expected.end) score++;
    }
    if (total > 0 && score / total > bestScore) { bestScore = score / total; bestSem = sem; }
  }
  return bestSem;
}

// Detecta la semana del patrón que mejor calza con los turnos reales de UNA semana del calendario.
// Soporta cambios parciales ("desde esta semana"): cada semana se evalúa por sus propios días.
export function detectSemanaForWeek(slot: CalendarSlot, patternRotation: WeekPattern[], weekDateStrs: string[]): number {
  const N = patternRotation.length;
  if (N <= 1) return 0;
  let bestSem = 0;
  let bestScore = -1;
  for (let sem = 0; sem < N; sem++) {
    let score = 0; let total = 0;
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = weekDateStrs[dow];
      if (!dateStr || !(dateStr in slot.days)) continue;
      const actual = slot.days[dateStr];
      const expected = patternRotation[sem][dow];
      total++;
      if (actual === null && expected === null) score += 1;
      else if (actual && expected && actual.start === expected.start && actual.end === expected.end) score += 1;
      else if (actual !== null && expected !== null) score += 0.25; // trabaja en ambos pero con horario distinto
    }
    if (total > 0 && score / total > bestScore) { bestScore = score / total; bestSem = sem; }
  }
  return bestSem;
}
export type AttendanceByRut = Record<string, Record<string, { entrada: string | null; salida: string | null }>>;
