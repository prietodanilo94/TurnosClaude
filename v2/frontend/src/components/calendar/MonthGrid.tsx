"use client";

import { useMemo } from "react";
import { buildMonthGrid } from "@/lib/calendar/month-grid";
import { overlappingIds as getOverlappingIds } from "@/lib/calendar/overlap-detector";
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { Worker } from "@/types/models";
import { WeekRow } from "./WeekRow";

interface MonthGridProps {
  year: number;
  month: number;
  franjaPorDia: Record<string, { apertura: string | null; cierre: string | null } | null>;
  holidays: string[];
  assignments: CalendarAssignment[];
  workers: Worker[];
  shifts: ShiftDef[];
  violations: Violation[];
  slotToWorker?: Record<number, Worker>;
  maxHours: number;
  partialRange?: { desde: string; hasta: string };
  onSlotClick?: (assignment: CalendarAssignment) => void;
}

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthGrid({
  year,
  month,
  franjaPorDia,
  holidays,
  assignments,
  workers,
  shifts,
  violations,
  slotToWorker = {},
  maxHours,
  partialRange,
  onSlotClick,
}: MonthGridProps) {
  const weeks = useMemo(
    () => buildMonthGrid(year, month, franjaPorDia, holidays),
    [year, month, franjaPorDia, holidays]
  );

  const slotByRut = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assignments) map[a.worker_rut] = a.worker_slot;
    return map;
  }, [assignments]);


  const violationsByAssignment = useMemo(() => {
    const map: Record<string, Violation[]> = {};
    for (const v of violations) {
      if (!v.worker_rut) continue;
      const affected = assignments.filter((a) => a.worker_rut === v.worker_rut);
      for (const a of affected) {
        if (!map[a.id]) map[a.id] = [];
        map[a.id].push(v);
      }
    }
    return map;
  }, [violations, assignments]);

  const overlapping = useMemo(
    () => getOverlappingIds(assignments, shifts),
    [assignments, shifts]
  );

  return (
    <div className="space-y-2">
      {/* Cabecera de días */}
      <div className="flex gap-2">
        <div className="flex-1 grid grid-cols-7 gap-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-xs font-semibold text-gray-500 text-center py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="w-28 shrink-0" />
      </div>

      {/* Filas de semanas */}
      {weeks.map((week) => (
        <WeekRow
          key={week.isoWeek}
          week={week}
          assignments={assignments}
          workers={workers}
          shifts={shifts}
          violationsByAssignment={violationsByAssignment}
          overlappingIds={overlapping}
          slotByRut={slotByRut}
          slotToWorker={slotToWorker}
          maxHours={maxHours}
          partialRange={partialRange}
          onSlotClick={onSlotClick}
        />
      ))}
    </div>
  );
}
