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
    if (!oldWorker || !newWorker || oldWorker !== newWorker) continue;
    const workerName = workerMap[oldWorker] ?? oldWorker;
    const oldSlot = oldSlotMap[slotNum];
    const newSlot = newSlotMap[slotNum];
    if (!oldSlot || !newSlot) continue;

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const oldShift = (oldSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null;
      const newShift = (newSlot.days as Record<string, { start: string; end: string } | null>)[dateStr] ?? null;
      const oldStr = oldShift ? `${oldShift.start}-${oldShift.end}` : null;
      const newStr = newShift ? `${newShift.start}-${newShift.end}` : null;
      if (oldStr === newStr) continue;

      const dt = new Date(`${dateStr}T12:00:00`);
      changes.push({
        workerId: oldWorker,
        workerName,
        date: dateStr,
        dayLabel: `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTH_SHORT[month]}`,
        from: oldStr,
        to: newStr,
      });
    }
  }
  return changes;
}
