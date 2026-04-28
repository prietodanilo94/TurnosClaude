import { getPattern } from "@/lib/patterns/catalog";
import type { CalendarSlot, ShiftCategory, DayShift } from "@/types";

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

/**
 * Genera los slots del calendario para un mes completo.
 * - workerCount: cantidad de trabajadores activos (sin contar virtuales aún).
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
    alert = "Solo hay 1 trabajador. No es posible generar una rotación adecuada.";
  } else if (workerCount === 3 && rotLen === 4) {
    alert =
      "Con 3 trabajadores en rotación de 4 semanas, queda un puesto descubierto. " +
      "El jefe debe cubrir manualmente ese turno.";
  }

  const slots: CalendarSlot[] = [];

  for (let slotNum = 1; slotNum <= workerCount; slotNum++) {
    const days: Record<string, DayShift | null> = {};

    // Recorrer todos los días del mes
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = fmt(date);

      // Número de semana ISO del lunes de esa semana (0-indexed desde epoch)
      const monday = new Date(date);
      monday.setDate(date.getDate() - dowIndex(date));
      const isoWeek = Math.floor(monday.getTime() / (7 * 24 * 3600 * 1000));

      // Para horario fijo (1 semana) siempre usa índice 0.
      // Para rotativos: la semana base del slot es (slotNum - 1).
      const baseOffset = rotLen === 1 ? 0 : slotNum - 1;
      const weekIdx = (isoWeek + baseOffset) % rotLen;

      const dow = dowIndex(date);
      days[dateStr] = pattern.rotationWeeks[weekIdx][dow] ?? null;
    }

    slots.push({ slotNumber: slotNum, days });
  }

  return { slots, totalWorkers: workerCount, alert };
}
