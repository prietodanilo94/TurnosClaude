export type WeekdayEs =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

const WEEKDAY_NAMES: WeekdayEs[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export interface DayInGrid {
  date: string;
  dayNumber: number;
  weekday: WeekdayEs;
  isCurrentMonth: boolean;
  isOpen: boolean;
  isHoliday: boolean;
  apertura: string | null;
  cierre: string | null;
}

export interface WeekInGrid {
  isoWeek: number;
  days: DayInGrid[];
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

function isoDow(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function buildMonthGrid(
  year: number,
  month: number,
  franjaPorDia: Record<string, { apertura: string | null; cierre: string | null } | null>,
  holidays: string[]
): WeekInGrid[] {
  const holidaySet = new Set(holidays);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - isoDow(firstDay));

  const lastDay = new Date(Date.UTC(year, month, 0));
  const gridEnd = new Date(lastDay);
  gridEnd.setUTCDate(lastDay.getUTCDate() + (6 - isoDow(lastDay)));

  const weeks: WeekInGrid[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const days: DayInGrid[] = [];
    const isoWeek = isoWeekNumber(cursor);

    for (let i = 0; i < 7; i++) {
      const dateStr = toDateStr(cursor);
      const isCurrentMonth = cursor.getUTCMonth() + 1 === month;
      const weekday = WEEKDAY_NAMES[i];
      const franja = franjaPorDia[weekday] ?? null;
      const isHoliday = isCurrentMonth && holidaySet.has(dateStr);
      const isOpen = isCurrentMonth && franja !== null && !isHoliday;

      days.push({
        date: dateStr,
        dayNumber: cursor.getUTCDate(),
        weekday,
        isCurrentMonth,
        isOpen,
        isHoliday,
        apertura: franja?.apertura ?? null,
        cierre: franja?.cierre ?? null,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    weeks.push({ isoWeek, days });
  }

  return weeks;
}
