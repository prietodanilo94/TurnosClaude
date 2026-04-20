"use client";

import { useState } from "react";
import type { Worker } from "@/types/models";
import type { CalendarAssignment } from "@/types/optimizer";
import { workerColor } from "./worker-colors";

interface Props {
  assignments: CalendarAssignment[];
  workers: Worker[];
  onApply: (mapping: Record<number, string>) => void;
  onClose: () => void;
}

export function WorkerMappingPanel({ assignments, workers, onApply, onClose }: Props) {
  const slots = [...new Set(assignments.map((a) => a.worker_slot))].sort((a, b) => a - b);

  const initialMapping: Record<number, string> = {};
  for (const slot of slots) {
    const a = assignments.find((x) => x.worker_slot === slot);
    if (a && !a.worker_rut.startsWith("worker_")) {
      initialMapping[slot] = a.worker_rut;
    }
  }

  const [mapping, setMapping] = useState<Record<number, string>>(initialMapping);

  function handleApply() {
    onApply(mapping);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Asignar trabajadores</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Vinculá cada slot generado con un trabajador real. Podés cambiarlos después.
          </p>
        </div>

        <div className="space-y-2.5">
          {slots.map((slot) => {
            const color = workerColor(slot);
            return (
              <div key={slot} className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 w-28 shrink-0`}>
                  <span className={`w-2 h-2 rounded-full ${color.bg} border ${color.border}`} />
                  <span className="text-sm text-gray-700">Trabajador {slot}</span>
                </div>
                <select
                  value={mapping[slot] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [slot]: e.target.value }))
                  }
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sin asignar —</option>
                  {workers.map((w) => (
                    <option key={w.$id} value={w.rut}>
                      {w.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
