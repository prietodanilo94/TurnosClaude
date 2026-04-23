import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";
import { getShiftWindow } from "./shift-utils";

export interface OverlapPair {
  a: CalendarAssignment;
  b: CalendarAssignment;
  date: string;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function detectOverlaps(
  assignments: CalendarAssignment[],
  shiftCatalog: ShiftDef[]
): OverlapPair[] {
  const shiftMap: Record<string, ShiftDef> = {};
  for (const s of shiftCatalog) {
    shiftMap[s.id] = s;
  }

  const byWorkerDay: Record<string, CalendarAssignment[]> = {};
  for (const a of assignments) {
    const key = `${a.worker_rut}__${a.date}`;
    if (!byWorkerDay[key]) byWorkerDay[key] = [];
    byWorkerDay[key].push(a);
  }

  const overlaps: OverlapPair[] = [];

  for (const group of Object.values(byWorkerDay)) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const si = shiftMap[group[i].shift_id];
        const sj = shiftMap[group[j].shift_id];
        if (!si || !sj) continue;

        const windowI = getShiftWindow(si, group[i].date);
        const windowJ = getShiftWindow(sj, group[j].date);
        if (!windowI || !windowJ) continue;

        const startI = parseTime(windowI.inicio);
        const endI = parseTime(windowI.fin);
        const startJ = parseTime(windowJ.inicio);
        const endJ = parseTime(windowJ.fin);

        if (startI < endJ && startJ < endI) {
          overlaps.push({ a: group[i], b: group[j], date: group[i].date });
        }
      }
    }
  }

  return overlaps;
}

export function overlappingIds(
  assignments: CalendarAssignment[],
  shiftCatalog: ShiftDef[]
): Set<string> {
  const pairs = detectOverlaps(assignments, shiftCatalog);
  const ids = new Set<string>();
  for (const { a, b } of pairs) {
    ids.add(a.id);
    ids.add(b.id);
  }
  return ids;
}
