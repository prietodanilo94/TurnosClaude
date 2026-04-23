import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";

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

        const startI = parseTime(si.inicio);
        const endI = parseTime(si.fin);
        const startJ = parseTime(sj.inicio);
        const endJ = parseTime(sj.fin);

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
