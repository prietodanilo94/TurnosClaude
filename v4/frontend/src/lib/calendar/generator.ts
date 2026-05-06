import { getPattern } from "../patterns/catalog";
import { dateRangeInclusive } from "../dates";
import type { CalendarSlot, ShiftCategory, DayShift, WorkerBlockInfo } from "../../types";

// Devuelve índice de día de la semana: Lun=0 ... Dom=6
function dowIndex(date: Date): number {
  return (date.getDay() + 6) % 7; // JS: Dom=0 → Lun=0
}

// Formato YYYY-MM-DD
function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface GenerateResult {
  slots: CalendarSlot[];
  totalWorkers: number;
  alert?: string;
}

export type WorkerBlockDateMap = Record<string, Record<string, string | null>>;

/**
 * Genera los slots del calendario para un mes completo.
 * - workerCount: cantidad de vendedores activos (sin contar virtuales aún).
 * - Para rotación biweekly: slot i parte en semana (i-1) % 2.
 * - Para rotación 4weekly:  slot i parte en semana (i-1) % 4.
 * - Para horario fijo:      todos tienen siempre semana 0.
 *
 * La rotación se ancla a la semana ISO del primer día del mes para que sea
 * consistente entre meses (misma semana ISO → mismo patrón de semana).
 */
export function generateCalendar(
  category: ShiftCategory,
  year: number,
  month: number,  // 1-based
  workerCount: number,
): GenerateResult {
  const pattern = getPattern(category);
  const rotLen = pattern.rotationWeeks.length;

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

  for (let slotNum = 1; slotNum <= workerCount; slotNum++) {
    const days: Record<string, DayShift | null> = {};

    const cur = new Date(startMonday);
    while (cur <= endSunday) {
      const dateStr = fmt(cur);

      const monday = new Date(cur);
      monday.setDate(cur.getDate() - dowIndex(cur));
      const isoWeek = Math.floor(monday.getTime() / (7 * 24 * 3600 * 1000));

      const weekIdx = pattern.fixedSlots
        ? (slotNum - 1) % rotLen
        : rotLen === 1 ? 0 : (isoWeek + slotNum - 1) % rotLen;

      const dow = dowIndex(cur);
      days[dateStr] = pattern.rotationWeeks[weekIdx][dow] ?? null;

      cur.setDate(cur.getDate() + 1);
    }

    slots.push({ slotNumber: slotNum, days });
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
