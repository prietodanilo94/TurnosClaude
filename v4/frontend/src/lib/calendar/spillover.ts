// Decision del usuario (2026-07-10): los dias remanentes de la ultima
// semana de un mes (los que caen en el mes siguiente) son REALES, no
// proyeccion. Dos movimientos, siempre hacia adelante:
//
// 1. Al GUARDAR el mes X: sus dias remanentes sobrescriben las fechas
//    equivalentes del calendario de X+1 si ya existe (por trabajador).
// 2. Al CREAR el mes X: sus primeros dias se siembran desde el remanente
//    que X-1 ya tenia guardado (la planificacion de esa semana ya se hizo
//    al armar X-1).
//
// La propiedad sigue siendo por mes (cada fecha tiene un dueno), pero el
// dueno nace/queda sincronizado con lo que el mes anterior decidio para la
// semana compartida. Nunca se propaga hacia atras (el pasado no se toca).
import type { CalendarSlot, DayShift } from "@/types";

export interface SpillDay {
  workerId: string;
  dateStr: string;
  shift: DayShift | null; // null = libre explicito
}

// Dias de la grilla de (year, month) que caen en el MES SIGUIENTE, por
// trabajador asignado. Incluye los null (libre decidido) — la semana
// completa viaja, no solo los turnos.
export function extractNextMonthSpillover(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  year: number,
  month: number,
): SpillDay[] {
  const nextStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const out: SpillDay[] = [];
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId) continue;
    for (const [dateStr, shift] of Object.entries(slot.days)) {
      if (dateStr >= nextStart) out.push({ workerId, dateStr, shift: (shift as DayShift | null) ?? null });
    }
  }
  return out;
}

// Solo los dias de spillover que REALMENTE cambiaron entre el estado previo
// y el nuevo de (year, month). Sin esto, cualquier guardado del mes —
// incluso editar un dia que no tiene nada que ver con el remanente — vuelve
// a extraer y reempujar TODO el remanente sobre el mes siguiente, pisando
// datos reales que ya divergieron alla (bug real, reportado 2026-07-13).
// oldSlots/oldAssignments null = primer guardado del mes (no habia estado
// previo): todo el remanente cuenta como cambio real, igual que antes.
export function diffSpilloverChanges(
  oldSlots: CalendarSlot[] | null,
  oldAssignments: Record<string, string | null> | null,
  newSlots: CalendarSlot[],
  newAssignments: Record<string, string | null>,
  year: number,
  month: number,
): SpillDay[] {
  const newSpill = extractNextMonthSpillover(newSlots, newAssignments, year, month);
  const oldSpill = oldSlots && oldAssignments ? extractNextMonthSpillover(oldSlots, oldAssignments, year, month) : [];
  const oldMap = new Map(oldSpill.map((s) => [`${s.workerId}|${s.dateStr}`, s.shift]));
  const newMap = new Map(newSpill.map((s) => [`${s.workerId}|${s.dateStr}`, s.shift]));
  const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changed: SpillDay[] = [];
  for (const key of keys) {
    const [workerId, dateStr] = key.split("|");
    const prev = oldMap.get(key) ?? null;
    const cur = newMap.has(key) ? newMap.get(key) ?? null : null;
    const prevStr = prev ? `${prev.start}-${prev.end}` : null;
    const curStr = cur ? `${cur.start}-${cur.end}` : null;
    if (!oldSlots || prevStr !== curStr) changed.push({ workerId, dateStr, shift: cur });
  }
  return changed;
}

// Aplica dias (por trabajador) sobre una copia de slots/assignments de otro
// calendario. Solo toca fechas que su grilla ya contiene y trabajadores que
// tiene asignados; devuelve si hubo cambios reales.
export function overlayDaysByWorker(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  days: SpillDay[],
): { slots: CalendarSlot[]; changed: boolean; applied: number; skippedWorkers: string[] } {
  const slotByWorker = new Map<string, number>();
  for (const [slotNum, workerId] of Object.entries(assignments)) {
    if (workerId) slotByWorker.set(workerId, Number(slotNum));
  }
  const next = slots.map((s) => ({ ...s, days: { ...s.days } }));
  let changed = false;
  let applied = 0;
  const skipped = new Set<string>();

  for (const { workerId, dateStr, shift } of days) {
    const slotNumber = slotByWorker.get(workerId);
    if (slotNumber === undefined) { skipped.add(workerId); continue; }
    const slot = next.find((s) => s.slotNumber === slotNumber);
    if (!slot || !(dateStr in slot.days)) continue;
    const current = (slot.days as Record<string, DayShift | null>)[dateStr] ?? null;
    const value = shift ?? null;
    const equal = (current === null && value === null) ||
      (current !== null && value !== null && current.start === value.start && current.end === value.end);
    if (!equal) {
      (slot.days as Record<string, DayShift | null>)[dateStr] = value;
      changed = true;
      applied++;
    }
  }
  return { slots: next, changed, applied, skippedWorkers: [...skipped] };
}
