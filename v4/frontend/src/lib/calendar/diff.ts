import type { CalendarSlot } from "@/types";

export interface ChangeItem {
  workerId: string;
  workerName: string;
  date: string;
  dayLabel: string;
  from: string | null;
  to: string | null;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function shiftStr(shift: { start: string; end: string } | null): string | null {
  return shift ? `${shift.start}-${shift.end}` : null;
}

function dayLabel(dateStr: string, month: number): string {
  const dt = new Date(`${dateStr}T12:00:00`);
  return `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTH_SHORT[month]}`;
}

export function computeCalendarDiff(
  oldSlots: CalendarSlot[],
  newSlots: CalendarSlot[],
  oldAssignments: Record<string, string | null>,
  newAssignments: Record<string, string | null>,
  workerMap: Record<string, string>,
  year: number,
  month: number,
): ChangeItem[] {
  const changes: ChangeItem[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  const oldSlotMap = Object.fromEntries(oldSlots.map((s) => [s.slotNumber, s]));
  const newSlotMap = Object.fromEntries(newSlots.map((s) => [s.slotNumber, s]));
  const allSlotNums = new Set([
    ...Object.keys(newAssignments).map(Number),
    ...Object.keys(oldAssignments).map(Number),
  ]);

  for (const slotNum of allSlotNums) {
    const oldWorker = oldAssignments[String(slotNum)] ?? null;
    const newWorker = newAssignments[String(slotNum)] ?? null;
    const oldSlot = oldSlotMap[slotNum];
    const newSlot = newSlotMap[slotNum];
    if (!oldSlot || !newSlot) continue;

    if (oldWorker && newWorker && oldWorker === newWorker) {
      // Mismo trabajador en el slot: diff dia a dia como siempre.
      const workerName = workerMap[oldWorker] ?? oldWorker;
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const oldStr = shiftStr((oldSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null);
        const newStr = shiftStr((newSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null);
        if (oldStr === newStr) continue;
        changes.push({ workerId: oldWorker, workerName, date: dateStr, dayLabel: dayLabel(dateStr, month), from: oldStr, to: newStr });
      }
      continue;
    }

    // El slot cambio de trabajador (asignacion nueva sobre un slot vacio,
    // reemplazo por otro trabajador, o quedo sin asignar). Antes esto se
    // saltaba por completo — un trabajador recien asignado a un slot
    // desaparecia del historial de cambios aunque su calendario quedara
    // guardado correctamente (bug real, reportado 2026-07-13).
    if (oldWorker) {
      // El trabajador anterior pierde el slot: sus turnos pasan a libre.
      const workerName = workerMap[oldWorker] ?? oldWorker;
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const oldStr = shiftStr((oldSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null);
        if (!oldStr) continue;
        changes.push({ workerId: oldWorker, workerName, date: dateStr, dayLabel: dayLabel(dateStr, month), from: oldStr, to: null });
      }
    }
    if (newWorker) {
      // El trabajador nuevo gana el slot: sus turnos nacen desde libre.
      const workerName = workerMap[newWorker] ?? newWorker;
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const newStr = shiftStr((newSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null);
        if (!newStr) continue;
        changes.push({ workerId: newWorker, workerName, date: dateStr, dayLabel: dayLabel(dateStr, month), from: null, to: newStr });
      }
    }
  }
  return changes;
}
