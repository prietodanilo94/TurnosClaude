// F11 Fase 0 — extrae del calendario REAL guardado del mes anterior los
// ultimos `tailDays` dias por trabajador asignado. Lo consume
// validateCalendarForPublish (parametro prevMonthShifts) para calcular
// rachas de dias consecutivos y horas de la semana frontera contra lo
// realmente publicado, en vez de contra la grilla extendida del mes actual
// (que asume el patron de rotacion y puede no coincidir con calendarios
// editados a mano o cargados desde Excel).
import type { CalendarSlot, DayShift } from "@/types";
import type { PrevMonthShiftsMap } from "./validation";

export interface PrevCalendarRow {
  slotsData: string;
  assignments: string;
}

// null explicito en una fecha = ese dia estaba libre segun lo publicado
// (distinto de omitir la fecha, que significaria "sin informacion").
export function extractPrevMonthTail(
  prevCal: PrevCalendarRow | null | undefined,
  prevYear: number,
  prevMonth: number,
  tailDays = 7,
): PrevMonthShiftsMap {
  if (!prevCal) return {};

  let slots: CalendarSlot[];
  let assignments: Record<string, string | null>;
  try {
    slots = JSON.parse(prevCal.slotsData);
    assignments = JSON.parse(prevCal.assignments);
  } catch {
    return {};
  }
  if (!Array.isArray(slots)) return {};

  const lastDay = new Date(prevYear, prevMonth, 0).getDate();
  const dates: string[] = [];
  for (let d = Math.max(1, lastDay - tailDays + 1); d <= lastDay; d++) {
    dates.push(`${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const tail: PrevMonthShiftsMap = {};
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId || tail[workerId]) continue;
    const perDate: Record<string, DayShift | null> = {};
    for (const dateStr of dates) {
      perDate[dateStr] = (slot.days as Record<string, DayShift | null>)[dateStr] ?? null;
    }
    tail[workerId] = perDate;
  }
  return tail;
}

// Cabeza del mes SIGUIENTE (primeros `headDays` dias) por trabajador — el
// espejo de extractPrevMonthTail, para que la ultima semana del mes muestre
// y valide los dias del mes siguiente con datos reales.
export function extractNextMonthHead(
  nextCal: PrevCalendarRow | null | undefined,
  nextYear: number,
  nextMonth: number,
  headDays = 7,
): PrevMonthShiftsMap {
  if (!nextCal) return {};

  let slots: CalendarSlot[];
  let assignments: Record<string, string | null>;
  try {
    slots = JSON.parse(nextCal.slotsData);
    assignments = JSON.parse(nextCal.assignments);
  } catch {
    return {};
  }
  if (!Array.isArray(slots)) return {};

  const dates: string[] = [];
  for (let d = 1; d <= headDays; d++) {
    dates.push(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const head: PrevMonthShiftsMap = {};
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId || head[workerId]) continue;
    const perDate: Record<string, DayShift | null> = {};
    for (const dateStr of dates) {
      perDate[dateStr] = (slot.days as Record<string, DayShift | null>)[dateStr] ?? null;
    }
    head[workerId] = perDate;
  }
  return head;
}

// Une las colas de varios calendarios (grupos: un calendario por equipo).
// Los workerId no se repiten entre equipos, asi que no hay colisiones reales.
export function mergePrevMonthTails(tails: PrevMonthShiftsMap[]): PrevMonthShiftsMap {
  return Object.assign({}, ...tails);
}
