"use client";

import type { MouseEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { DayInGrid } from "@/lib/calendar/month-grid";
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { SlotOverride, Worker } from "@/types/models";
import { ShiftSlot } from "./ShiftSlot";

interface DayCellProps {
  day: DayInGrid;
  assignments: CalendarAssignment[];
  workers: Worker[];
  shifts: ShiftDef[];
  violationsByAssignment: Record<string, Violation[]>;
  overlappingIds: Set<string>;
  slotToWorker?: Record<number, Worker>;
  currentOverrides?: SlotOverride[];
  partialRange?: { desde: string; hasta: string };
  onSlotClick?: (assignment: CalendarAssignment) => void;
  onAssignmentContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    payload: { assignment: CalendarAssignment; override?: SlotOverride }
  ) => void;
  onFreeSlotContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    payload: { date: string; slot: number; override?: SlotOverride; isSunday: boolean }
  ) => void;
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
  slotToWorker = {},
  currentOverrides = [],
  partialRange,
  onSlotClick,
  onAssignmentContextMenu,
  onFreeSlotContextMenu,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: day.date });

  const shiftMap: Record<string, ShiftDef> = {};
  for (const s of shifts) shiftMap[s.id] = s;
  const workerMap: Record<string, Worker> = {};
  for (const w of workers) workerMap[w.rut] = w;

  const dayAssignments = assignments.filter((a) => a.date === day.date);
  const overridesBySlot = new Map<number, SlotOverride>();
  for (const override of currentOverrides) {
    if (override.fecha === day.date && override.slot_numero !== undefined) {
      overridesBySlot.set(override.slot_numero, override);
    }
  }

  // Modo revisión parcial: determinar si el día está dentro o fuera del rango
  const partialStatus = partialRange && day.isCurrentMonth
    ? day.date >= partialRange.desde && day.date <= partialRange.hasta
      ? "in-range"
      : "out-of-range"
    : null;

  const bgClass = !day.isCurrentMonth
    ? "bg-gray-50"
    : day.isHoliday
    ? "bg-orange-50"
    : !day.isOpen
    ? "bg-gray-100"
    : "bg-white";

  const dropRing = isOver && day.isCurrentMonth && day.isOpen
    ? "ring-2 ring-blue-400 ring-inset"
    : "";

  const partialClass = partialStatus === "in-range"
    ? "ring-2 ring-emerald-400 ring-inset"
    : partialStatus === "out-of-range"
    ? "opacity-40 pointer-events-none"
    : "";

  return (
    <div
      ref={setNodeRef}
      data-date={day.date}
      className={[
        "min-h-[80px] border border-gray-200 rounded-md p-1.5 flex flex-col gap-1",
        bgClass,
        partialStatus === "in-range" ? dropRing || partialClass : dropRing,
        partialStatus !== "in-range" ? partialClass : "",
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
        <div className="flex gap-0.5 text-[10px] items-center">
          {partialStatus === "in-range" && (
            <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 rounded">
              mod
            </span>
          )}
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

      {/* Slots de turno — orden fijo por slot, incluye libres */}
      <div className="flex flex-col gap-0.5">
        {workers.length > 0
          ? Array.from({ length: workers.length }, (_, i) => i + 1).map((slot) => {
              const a = dayAssignments.find((x) => x.worker_slot === slot);
              if (a) {
                return (
                  <ShiftSlot
                    key={a.id}
                    assignment={a}
                    shift={shiftMap[a.shift_id]}
                    worker={workerMap[a.worker_rut]}
                    violations={violationsByAssignment[a.id] ?? []}
                    isOverlapping={overlappingIds.has(a.id)}
                    hasOverride={overridesBySlot.has(a.worker_slot)}
                    onClick={() => onSlotClick?.(a)}
                    onContextMenu={(event) =>
                      onAssignmentContextMenu?.(event, {
                        assignment: a,
                        override: overridesBySlot.get(a.worker_slot),
                      })
                    }
                  />
                );
              }
              const w = (slotToWorker as Record<number, Worker>)[slot];
              const nombre = w
                ? w.nombre_completo.split(" ").slice(0, 2).join(" ")
                : `Trabajador ${slot}`;
              return (
                <div
                  key={`libre-${slot}`}
                  className="rounded-md border px-2 py-1 text-xs border-gray-100 bg-gray-50 text-gray-400 leading-tight relative"
                  onContextMenu={(event) =>
                    onFreeSlotContextMenu?.(event, {
                      date: day.date,
                      slot,
                      override: overridesBySlot.get(slot),
                      isSunday: day.weekday === "domingo",
                    })
                  }
                >
                  {overridesBySlot.has(slot) && (
                    <span className="absolute top-0.5 left-0.5 text-amber-600 font-bold text-[10px]">✎</span>
                  )}
                  <div className="font-medium truncate">{nombre}</div>
                  <div className="italic text-[10px]">libre</div>
                </div>
              );
            })
          : dayAssignments.map((a) => (
              <ShiftSlot
                key={a.id}
                assignment={a}
                shift={shiftMap[a.shift_id]}
                worker={workerMap[a.worker_rut]}
                violations={violationsByAssignment[a.id] ?? []}
                isOverlapping={overlappingIds.has(a.id)}
                hasOverride={overridesBySlot.has(a.worker_slot)}
                onClick={() => onSlotClick?.(a)}
                onContextMenu={(event) =>
                  onAssignmentContextMenu?.(event, {
                    assignment: a,
                    override: overridesBySlot.get(a.worker_slot),
                  })
                }
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
