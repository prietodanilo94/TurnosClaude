"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { Worker } from "@/types/models";
import { workerColor, UNASSIGNED_COLOR } from "./worker-colors";

interface ShiftSlotProps {
  assignment: CalendarAssignment;
  shift: ShiftDef | undefined;
  worker: Worker | undefined;
  violations: Violation[];
  isOverlapping: boolean;
  onClick?: () => void;
}

export function ShiftSlot({
  assignment,
  shift,
  worker,
  violations,
  isOverlapping,
  onClick,
}: ShiftSlotProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    data: { assignment },
  });

  const color = assignment.worker_slot > 0
    ? workerColor(assignment.worker_slot)
    : UNASSIGNED_COLOR;

  const hasViolation = violations.length > 0 || isOverlapping;
  const violationMessages = [
    ...violations.map((v) => v.detalle),
    ...(isOverlapping ? ["Solapamiento horario con otro turno"] : []),
  ];

  const label = worker
    ? worker.nombre_completo.split(" ").slice(0, 2).join(" ")
    : `Trabajador ${assignment.worker_slot}`;

  const timeRange = shift
    ? `${shift.inicio}–${shift.fin}`
    : assignment.shift_id;

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div className="relative group">
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={[
          "rounded-md border px-2 py-1 text-xs leading-tight select-none transition-opacity hover:opacity-90",
          hasViolation
            ? "border-red-500 ring-1 ring-red-400 bg-red-50 text-red-700"
            : `${color.border} ${color.bg} ${color.text}`,
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <div className="font-medium truncate">{label}</div>
        <div className="opacity-75">{timeRange}</div>
        {hasViolation && (
          <span className="absolute top-0.5 right-0.5 text-red-500 font-bold text-[10px]">!</span>
        )}
      </div>

      {/* Tooltip de violaciones — Task 12 */}
      {hasViolation && violationMessages.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 hidden group-hover:block">
          <div className="bg-gray-900 text-white text-xs rounded-md p-2 w-52 shadow-lg space-y-1">
            {violationMessages.map((msg, i) => (
              <p key={i} className="leading-snug">⚠ {msg}</p>
            ))}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 ml-2 -mt-1" />
        </div>
      )}
    </div>
  );
}
