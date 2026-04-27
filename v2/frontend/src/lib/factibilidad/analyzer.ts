import { getMaxConsecutiveWorkedDays } from "@/lib/calendar/consecutive-days";
import {
  FACTIBILITY_WEEKDAYS,
  type FactibilityAnalysis,
  type FactibilityCoverageCell,
  type FactibilityOption,
  type FactibilityViolation,
  type FactibilityView,
  type FactibilityWeekday,
} from "./types";

const START_DATE = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface CalendarDayCell {
  weekIndex: number;
  cycleWeekIndex: number;
  date: string;
  day: FactibilityWeekday;
  inMonth: boolean;
}

function getMonthCalendarDays(year: number, month: number): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const lastOfMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  const firstWeekday = firstOfMonth.getUTCDay() || 7;
  const start = addDays(firstOfMonth, -(firstWeekday - 1));
  const lastWeekday = lastOfMonth.getUTCDay() || 7;
  const end = addDays(lastOfMonth, 7 - lastWeekday);

  const days: CalendarDayCell[] = [];
  let cursor = start;
  let index = 0;
  while (cursor.getTime() <= end.getTime()) {
    const weekday = FACTIBILITY_WEEKDAYS[index % 7];
    days.push({
      weekIndex: Math.floor(index / 7),
      cycleWeekIndex: Math.floor(index / 7) % 4,
      date: toDateString(cursor),
      day: weekday,
      inMonth: cursor.getUTCMonth() === month - 1,
    });
    cursor = addDays(cursor, 1);
    index += 1;
  }
  return days;
}

function getCycleCalendarDays(): CalendarDayCell[] {
  return Array.from({ length: 28 }, (_, index) => ({
    weekIndex: Math.floor(index / 7),
    cycleWeekIndex: Math.floor(index / 7),
    date: toDateString(addDays(START_DATE, index)),
    day: FACTIBILITY_WEEKDAYS[index % 7],
    inMonth: true,
  }));
}

function buildCalendarDays(view: FactibilityView): CalendarDayCell[] {
  if (view.mode === "month") {
    return getMonthCalendarDays(view.year, view.month);
  }
  return getCycleCalendarDays();
}

function createCoverageCells(
  option: FactibilityOption,
  calendarDays: CalendarDayCell[]
): FactibilityCoverageCell[] {
  const cells: FactibilityCoverageCell[] = [];
  for (const calendarDay of calendarDays) {
    let apeOnDuty = 0;
    let cieOnDuty = 0;
    for (const worker of option.workers) {
      if (worker.offDays[calendarDay.cycleWeekIndex] === calendarDay.day) continue;
      if (worker.weeklyRoles[calendarDay.cycleWeekIndex] === "APE") apeOnDuty += 1;
      if (worker.weeklyRoles[calendarDay.cycleWeekIndex] === "CIE") cieOnDuty += 1;
    }
    cells.push({
      weekIndex: calendarDay.weekIndex,
      cycleWeekIndex: calendarDay.cycleWeekIndex,
      date: calendarDay.date,
      day: calendarDay.day,
      inMonth: calendarDay.inMonth,
      apeOnDuty,
      cieOnDuty,
      totalOnDuty: apeOnDuty + cieOnDuty,
      meetsBaseCoverage: apeOnDuty >= 1 && cieOnDuty >= 1,
    });
  }
  return cells;
}

function getWorkerWorkedDates(
  option: FactibilityOption,
  workerId: string,
  calendarDays: CalendarDayCell[]
): { visible: string[]; inMonth: string[] } {
  const worker = option.workers.find((item) => item.id === workerId);
  if (!worker) return { visible: [], inMonth: [] };

  const visible: string[] = [];
  const inMonth: string[] = [];

  for (const day of calendarDays) {
    const isOff = worker.offDays[day.cycleWeekIndex] === day.day;
    if (isOff) continue;
    visible.push(day.date);
    if (day.inMonth) inMonth.push(day.date);
  }

  return { visible, inMonth };
}

function getAllowedWorkedSundays(totalSundaysInScope: number): number {
  return Math.max(0, totalSundaysInScope - 2);
}

export function analyzeFactibilityOption(
  option: FactibilityOption,
  view: FactibilityView = { mode: "cycle" }
): FactibilityAnalysis {
  const calendarDays = buildCalendarDays(view);
  const coverageCells = createCoverageCells(option, calendarDays);
  const violations: FactibilityViolation[] = [];
  const totalSundaysInScope = coverageCells.filter(
    (cell) => cell.inMonth && cell.day === "domingo"
  ).length;
  const maxAllowedWorkedSundays = getAllowedWorkedSundays(totalSundaysInScope);

  for (const cell of coverageCells) {
    if (cell.inMonth && !cell.meetsBaseCoverage) {
      const missingRole = cell.apeOnDuty === 0 ? "APE" : "CIE";
      violations.push({
        severity: "error",
        type: "coverage",
        title: "Brecha de cobertura",
        detail: `${cell.date} (${cell.day}): falta ${missingRole}`,
        weekIndex: cell.weekIndex,
        day: cell.day,
      });
    }
  }

  const workerMetrics = option.workers.map((worker) => {
    const workedDates = getWorkerWorkedDates(option, worker.id, calendarDays);
    const workedSundays = workedDates.inMonth.filter(
      (date) => coverageCells.find((cell) => cell.date === date)?.day === "domingo"
    ).length;
    const maxConsecutive = getMaxConsecutiveWorkedDays(workedDates.visible);

    if (workedSundays > maxAllowedWorkedSundays) {
      violations.push({
        severity: "error",
        type: "sundays",
        title: "Exceso de domingos trabajados",
        detail: `${worker.label} trabaja ${workedSundays} domingos; maximo permitido ${maxAllowedWorkedSundays}`,
        workerId: worker.id,
      });
    }

    if (maxConsecutive > 6) {
      violations.push({
        severity: "error",
        type: "consecutive",
        title: "Racha mayor a 6 dias",
        detail: `${worker.label} alcanza ${maxConsecutive} dias seguidos`,
        workerId: worker.id,
      });
    }

    return {
      workerId: worker.id,
      label: worker.label,
      group: worker.group,
      workedSundays,
      sundayFreeCount: 4 - workedSundays,
      maxConsecutive,
    };
  });

  const maxConsecutiveOverall = workerMetrics.reduce(
    (max, worker) => Math.max(max, worker.maxConsecutive),
    0
  );
  const maxWorkedSundays = workerMetrics.reduce(
    (max, worker) => Math.max(max, worker.workedSundays),
    0
  );
  const inMonthCoverage = coverageCells.filter((cell) => cell.inMonth);
  const minTotalOnDuty = inMonthCoverage.reduce(
    (min, cell) => Math.min(min, cell.totalOnDuty),
    Number.POSITIVE_INFINITY
  );

  return {
    feasible: !violations.some((item) => item.severity === "error"),
    maxConsecutiveOverall,
    maxWorkedSundays,
    maxAllowedWorkedSundays,
    totalSundaysInScope,
    minTotalOnDuty,
    visibleWeekCount: Math.max(...coverageCells.map((cell) => cell.weekIndex)) + 1,
    coverageCells,
    workerMetrics,
    violations,
  };
}

type OffSequence = FactibilityWeekday[];

const groupTemplateCache = new Map<number, OffSequence[]>();
const WEEKDAY_ROTATION: FactibilityWeekday[] = [
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "lunes",
];

export function buildGroupOffTemplates(groupSize: number, numWeeks = 4): OffSequence[] {
  const cacheKey = groupSize * 10 + numWeeks;
  const cached = groupTemplateCache.get(cacheKey);
  if (cached) return cached;

  if (groupSize < 2) {
    throw new Error(`Grupo ${groupSize} no puede cubrir 7 dias con 1 libre semanal`);
  }

  const templates = Array.from({ length: groupSize }, () =>
    Array.from({ length: numWeeks }, () => "domingo" as FactibilityWeekday)
  );

  for (let weekIndex = 0; weekIndex < numWeeks; weekIndex += 1) {
    const sundayWorker = weekIndex % groupSize;
    templates[sundayWorker][weekIndex] =
      WEEKDAY_ROTATION[(weekIndex + sundayWorker) % WEEKDAY_ROTATION.length];
  }

  groupTemplateCache.set(
    cacheKey,
    templates.map((sequence) => [...sequence])
  );
  return templates;
}
