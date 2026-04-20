"use client";

import type { WeekInGrid } from "@/lib/calendar/month-grid";
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { Worker } from "@/types/models";
import { DayCell } from "./DayCell";
import { WeekHoursSummary } from "./WeekHoursSummary";
import { calculateHours } from "@/lib/calendar/hours-calculator";

interface WeekRowProps {
  week: WeekInGrid;
  assignments: CalendarAssignment[];
  workers: Worker[];
  shifts: ShiftDef[];
  violationsByAssignment: Record<string, Violation[]>;
  overlappingIds: Set<string>;
  slotByRut: Record<string, number>;
  maxHours: number;
  partialRange?: { desde: string; hasta: string };
  onSlotClick?: (assignment: CalendarAssignment) => void;
}

export function WeekRow({
  week,
  assignments,
  workers,
  shifts,
  violationsByAssignment,
  overlappingIds,
  slotByRut,
  maxHours,
  partialRange,
  onSlotClick,
}: WeekRowProps) {
  const weekAssignments = assignments.filter((a) => {
    const d = new Date(a.date + "T12:00:00");
    const dow = d.getUTCDay() || 7;
    const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - dow));
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return wk === week.isoWeek;
  });

  const hoursMap = calculateHours(weekAssignments, shifts);
  const hoursByWorker: Record<string, number> = {};
  for (const [rut, weeks] of Object.entries(hoursMap)) {
    hoursByWorker[rut] = weeks[week.isoWeek] ?? 0;
  }

  const isPartialWeek = week.days.some((d) => !d.isCurrentMonth);

  return (
    <div className="flex gap-2">
      {/* 7 celdas (lun–dom) */}
      <div className="flex-1 grid grid-cols-7 gap-1">
        {week.days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            assignments={assignments}
            workers={workers}
            shifts={shifts}
            violationsByAssignment={violationsByAssignment}
            overlappingIds={overlappingIds}
            partialRange={partialRange}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>

      {/* Contador de horas */}
      <WeekHoursSummary
        isoWeek={week.isoWeek}
        hoursByWorker={hoursByWorker}
        workers={workers}
        slotByRut={slotByRut}
        maxHours={maxHours}
        isPartialWeek={isPartialWeek}
      />
    </div>
  );
}
