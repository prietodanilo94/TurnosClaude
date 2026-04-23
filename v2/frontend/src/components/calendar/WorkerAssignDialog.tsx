"use client";

import { useEffect, useRef } from "react";
import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";
import type { Worker } from "@/types/models";
import { workerColor } from "./worker-colors";
import { getShiftWindow } from "@/lib/calendar/shift-utils";

interface WorkerAssignDialogProps {
  assignment: CalendarAssignment;
  shift: ShiftDef | undefined;
  workers: Worker[];
  onAssign: (workerRut: string, workerSlot: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function WorkerAssignDialog({
  assignment,
  shift,
  workers,
  onAssign,
  onRemove,
  onClose,
}: WorkerAssignDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const shiftWindow = getShiftWindow(shift, assignment.date);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-80 p-4 space-y-3">
        {/* Cabecera */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Asignar trabajador</p>
            <p className="text-xs text-gray-500">
              {assignment.date} — {shiftWindow ? `${shiftWindow.inicio}-${shiftWindow.fin}` : assignment.shift_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Lista de trabajadores */}
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {workers.map((worker, idx) => {
            const slot = idx + 1;
            const color = workerColor(slot);
            const isCurrent = worker.rut === assignment.worker_rut;
            return (
              <button
                key={worker.$id}
                onClick={() => {
                  onAssign(worker.rut, slot);
                  onClose();
                }}
                className={[
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
                  isCurrent
                    ? `${color.bg} ${color.text} border ${color.border} font-medium`
                    : "hover:bg-gray-50 text-gray-700 border border-transparent",
                ].join(" ")}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${color.bg} border ${color.border}`}
                />
                <span className="flex-1 truncate">{worker.nombre_completo}</span>
                {isCurrent && (
                  <span className="text-[10px] opacity-60">actual</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Eliminar turno */}
        <div className="border-t pt-2">
          <button
            onClick={() => {
              onRemove();
              onClose();
            }}
            className="w-full text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md px-3 py-1.5 transition-colors text-left"
          >
            Eliminar este turno
          </button>
        </div>
      </div>
    </div>
  );
}
