import { getPatternOrThrow } from "../patterns/catalog";
import { dateRangeInclusive } from "../dates";
import { dowIndex, fmt } from "./calendar-utils";
import { getWeekIndex } from "../week-index";
import type { CalendarSlot, ShiftPatternDef, DayShift, WorkerBlockInfo } from "../../types";

export interface GenerateResult {
  slots: CalendarSlot[];
  totalWorkers: number;
  alert?: string;
}

export type WorkerBlockDateMap = Record<string, Record<string, string | null>>;

/**
 * Genera los slots del calendario para un mes completo.
 * - slotAnchors: un valor de rotacion por slot, en el mismo orden en que
 *   luego se asignaran los trabajadores (slot 1 = slotAnchors[0], etc).
 *   Ese valor NO es la posicion del slot — es el "rotationAnchor" fijo de
 *   cada trabajador (ver lib/calendar/rotationAnchor.ts), para que su
 *   semana de rotacion no cambie aunque cambie el orden alfabetico del
 *   equipo entre generaciones. Antes se usaba slotNum-1 directamente, lo
 *   que hacia que un mismo trabajador pudiera caer en semanas de rotacion
 *   distintas en dos meses distintos si el equipo cambiaba en el medio.
 * - Para rotación biweekly: anchor % 2.
 * - Para rotación 4weekly:  anchor % 4.
 * - Para horario fijo:      todos tienen siempre semana 0.
 *
 * La rotación se ancla a la semana ISO del primer día del mes para que sea
 * consistente entre meses (misma semana ISO → mismo patrón de semana).
 */
export function generateCalendar(
  category: string,
  year: number,
  month: number,  // 1-based
  slotAnchors: number[],
  patternOverride?: ShiftPatternDef,
): GenerateResult {
  const pattern = getPatternOrThrow(category, patternOverride);
  const rotLen = pattern.rotationWeeks.length;
  const workerCount = slotAnchors.length;

  let alert: string | undefined;
  if (workerCount === 1) {
    alert = "Solo hay 1 vendedor. No es posible generar una rotación adecuada.";
  } else if (workerCount === 3 && rotLen === 4) {
    alert =
      "Con 3 vendedores en rotación de 4 semanas, queda un puesto descubierto. " +
      "El supervisor debe cubrir manualmente ese turno.";
  }

  // Rango extendido: lunes de la semana del día 1 → domingo de la semana del último día.
  // Esto permite mostrar la grilla completa por semanas ISO en el calendario v4.
  const firstDay = new Date(year, month - 1, 1);
  const lastDayDate = new Date(year, month, 0);
  const startMonday = new Date(firstDay);
  startMonday.setDate(firstDay.getDate() - dowIndex(firstDay));
  const endSunday = new Date(lastDayDate);
  endSunday.setDate(lastDayDate.getDate() + (6 - dowIndex(lastDayDate)));

  const slots: CalendarSlot[] = [];

  // Compute semanaOffset for each slot: the rotation index active in week 1 of the month
  const firstDayMonday = new Date(firstDay);
  firstDayMonday.setDate(firstDay.getDate() - dowIndex(firstDay));
  const firstIsoWeek = getWeekIndex(firstDayMonday);

  for (let slotNum = 1; slotNum <= workerCount; slotNum++) {
    const anchor = slotAnchors[slotNum - 1];
    const days: Record<string, DayShift | null> = {};

    const cur = new Date(startMonday);
    while (cur <= endSunday) {
      const dateStr = fmt(cur);

      const monday = new Date(cur);
      monday.setDate(cur.getDate() - dowIndex(cur));
      const isoWeek = getWeekIndex(monday);

      const weekIdx = pattern.fixedSlots
        ? anchor % rotLen
        : rotLen === 1 ? 0 : (isoWeek + anchor) % rotLen;

      const dow = dowIndex(cur);
      days[dateStr] = pattern.rotationWeeks[weekIdx][dow] ?? null;

      cur.setDate(cur.getDate() + 1);
    }

    const semanaOffset = pattern.fixedSlots
      ? anchor % rotLen
      : rotLen === 1 ? 0 : (firstIsoWeek + anchor) % rotLen;

    slots.push({ slotNumber: slotNum, days, semanaOffset });
  }

  return { slots, totalWorkers: workerCount, alert };
}

export function buildWorkerBlockDateMap(blocks: WorkerBlockInfo[]): WorkerBlockDateMap {
  const result: WorkerBlockDateMap = {};

  for (const block of blocks) {
    if (!result[block.workerId]) {
      result[block.workerId] = {};
    }

    for (const dateStr of dateRangeInclusive(block.startDate, block.endDate)) {
      result[block.workerId][dateStr] = block.motivo ?? null;
    }
  }

  return result;
}

export function isWorkerBlockedOnDate(
  blockMap: WorkerBlockDateMap,
  workerId: string | null | undefined,
  dateStr: string,
): boolean {
  if (!workerId) return false;
  return !!blockMap[workerId]?.[dateStr];
}

export function getWorkerBlockReason(
  blockMap: WorkerBlockDateMap,
  workerId: string | null | undefined,
  dateStr: string,
): string | null {
  if (!workerId) return null;
  return blockMap[workerId]?.[dateStr] ?? null;
}

export function applyWorkerBlocksToSlots(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  blockMap: WorkerBlockDateMap,
): CalendarSlot[] {
  return slots.map((slot) => {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId || !blockMap[workerId]) return slot;

    const days: Record<string, DayShift | null> = {};
    for (const [dateStr, shift] of Object.entries(slot.days)) {
      days[dateStr] = isWorkerBlockedOnDate(blockMap, workerId, dateStr) ? null : shift;
    }

    return { ...slot, days };
  });
}
