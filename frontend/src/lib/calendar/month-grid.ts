/**
 * Genera la grilla mensual: semanas ISO con sus 7 días (lun-dom).
 * Los días fuera del mes aparecen con isCurrentMonth=false.
 */

export type WeekdayEs =
  | "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

const WEEKDAY_NAMES: WeekdayEs[] = [
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
];

export interface DayInGrid {
  date: string;           // "YYYY-MM-DD"
  dayNumber: number;      // 1-31
  weekday: WeekdayEs;
  isCurrentMonth: boolean;
  isOpen: boolean;
  isHoliday: boolean;
  apertura: string | null;
  cierre: string | null;
}

export interface WeekInGrid {
  isoWeek: number;
  days: DayInGrid[];      // siempre 7 (lun→dom)
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function isoWeekNumber(d: Date): number {
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ISO day of week: Mon=0 … Sun=6
function isoDow(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function buildMonthGrid(
  year: number,
  month: number,     // 1-based
  franjaPorDia: Record<string, { apertura: string; cierre: string } | null>,
  holidays: string[]
): WeekInGrid[] {
  const holidaySet = new Set(holidays);

  // Primer día del mes
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  // Retroceder al lunes de esa semana
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - isoDow(firstDay));

  // Último día del mes
  const lastDay = new Date(Date.UTC(year, month, 0));
  // Avanzar al domingo de esa semana
  const gridEnd = new Date(lastDay);
  gridEnd.setUTCDate(lastDay.getUTCDate() + (6 - isoDow(lastDay)));

  const weeks: WeekInGrid[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const weekDays: DayInGrid[] = [];
    const isoWk = isoWeekNumber(cursor);

    for (let i = 0; i < 7; i++) {
      const dateStr = toDateStr(cursor);
      const dayNum = cursor.getUTCDate();
      const isCurrentMonth = cursor.getUTCMonth() + 1 === month;
      const weekday = WEEKDAY_NAMES[i];
      const franja = franjaPorDia[weekday] ?? null;
      const isOpen = isCurrentMonth && franja !== null;

      weekDays.push({
        date: dateStr,
        dayNumber: dayNum,
        weekday,
        isCurrentMonth,
        isOpen,
        isHoliday: isCurrentMonth && holidaySet.has(dateStr),
        apertura: franja?.apertura ?? null,
        cierre: franja?.cierre ?? null,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    weeks.push({ isoWeek: isoWk, days: weekDays });
  }

  return weeks;
}
