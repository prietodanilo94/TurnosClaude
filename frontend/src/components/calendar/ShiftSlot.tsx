"use client";

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
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function ShiftSlot({
  assignment,
  shift,
  worker,
  violations,
  isOverlapping,
  onClick,
  dragHandleProps,
}: ShiftSlotProps) {
  const color = assignment.worker_slot > 0
    ? workerColor(assignment.worker_slot)
    : UNASSIGNED_COLOR;

  const hasViolation = violations.length > 0 || isOverlapping;
  const violationText = violations.map((v) => v.detalle).join(" | ");

  const label = worker
    ? worker.nombre_completo.split(" ").slice(0, 2).join(" ")
    : `Trabajador ${assignment.worker_slot}`;

  const timeRange = shift
    ? `${shift.inicio}–${shift.fin}`
    : assignment.shift_id;

  return (
    <div
      title={hasViolation ? (violationText || "Solapamiento horario") : undefined}
      className={[
        "relative rounded-md border px-2 py-1 text-xs leading-tight cursor-pointer select-none",
        "transition-opacity hover:opacity-90",
        hasViolation ? "border-red-500 ring-1 ring-red-400" : color.border,
        hasViolation ? "bg-red-50 text-red-700" : `${color.bg} ${color.text}`,
      ].join(" ")}
      onClick={onClick}
      {...dragHandleProps}
    >
      <div className="font-medium truncate">{label}</div>
      <div className="opacity-75">{timeRange}</div>
      {hasViolation && (
        <span className="absolute top-0.5 right-0.5 text-red-500 font-bold text-[10px]">!</span>
      )}
    </div>
  );
}
