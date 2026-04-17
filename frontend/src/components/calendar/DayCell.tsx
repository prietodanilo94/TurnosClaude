"use client";

import type { DayInGrid } from "@/lib/calendar/month-grid";
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { Worker } from "@/types/models";
import { ShiftSlot } from "./ShiftSlot";

interface DayCellProps {
  day: DayInGrid;
  assignments: CalendarAssignment[];
  workers: Worker[];
  shifts: ShiftDef[];
  violationsByAssignment: Record<string, Violation[]>;
  overlappingIds: Set<string>;
  onSlotClick?: (assignment: CalendarAssignment) => void;
}

const WEEKDAY_LABELS: Record<string, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié",
  jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

export function DayCell({
  day,
  assignments,
  workers,
  shifts,
  violationsByAssignment,
  overlappingIds,
  onSlotClick,
}: DayCellProps) {
  const shiftMap: Record<string, ShiftDef> = {};
  for (const s of shifts) shiftMap[s.id] = s;
  const workerMap: Record<string, Worker> = {};
  for (const w of workers) workerMap[w.rut] = w;

  const dayAssignments = assignments.filter((a) => a.date === day.date);

  const bgClass = !day.isCurrentMonth
    ? "bg-gray-50"
    : day.isHoliday
    ? "bg-orange-50"
    : !day.isOpen
    ? "bg-gray-100"
    : "bg-white";

  return (
    <div
      className={[
        "min-h-[80px] border border-gray-200 rounded-md p-1.5 flex flex-col gap-1",
        bgClass,
        !day.isCurrentMonth ? "opacity-40" : "",
      ].join(" ")}
    >
      {/* Cabecera del día */}
      <div className="flex items-center justify-between">
        <span className={[
          "text-xs font-medium",
          day.isHoliday ? "text-orange-600" : "text-gray-500",
        ].join(" ")}>
          {WEEKDAY_LABELS[day.weekday]} {day.dayNumber}
        </span>
        <div className="flex gap-0.5 text-[10px]">
          {day.isHoliday && <span title="Feriado">🔒</span>}
          {(day.weekday === "sabado" || day.weekday === "domingo") && day.isOpen && (
            <span title="Fin de semana">✳️</span>
          )}
        </div>
      </div>

      {/* Franja horaria */}
      {day.isOpen && day.apertura && (
        <div className="text-[10px] text-gray-400">
          {day.apertura}–{day.cierre}
        </div>
      )}

      {/* Slots de turno */}
      <div className="flex flex-col gap-0.5">
        {dayAssignments.map((a) => (
          <ShiftSlot
            key={a.id}
            assignment={a}
            shift={shiftMap[a.shift_id]}
            worker={workerMap[a.worker_rut]}
            violations={violationsByAssignment[a.id] ?? []}
            isOverlapping={overlappingIds.has(a.id)}
            onClick={() => onSlotClick?.(a)}
          />
        ))}
      </div>

      {/* Día cerrado */}
      {day.isCurrentMonth && !day.isOpen && !day.isHoliday && (
        <div className="text-[10px] text-gray-400 italic">Cerrado</div>
      )}
    </div>
  );
}
