"use client";

import { useState } from "react";
import { useCalendarStore } from "@/store/calendar-store";

export interface PartialRecalculateParams {
  desde: string;       // "YYYY-MM-DD"
  hasta: string;       // "YYYY-MM-DD"
  excludedRuts: string[];
  modo: "ilp" | "greedy";
}

interface Props {
  onConfirm: (params: PartialRecalculateParams) => void;
  onClose: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function PartialRecalculateDialog({ onConfirm, onClose }: Props) {
  const { year, month, workers } = useCalendarStore();

  const firstDay = `${year}-${pad(month)}-01`;
  const lastDay  = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;

  const [desde, setDesde] = useState(firstDay);
  const [hasta, setHasta] = useState(lastDay);
  const [excludedRuts, setExcludedRuts] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<"ilp" | "greedy">("ilp");
  const [rangeError, setRangeError] = useState<string | null>(null);

  function toggleWorker(rut: string) {
    setExcludedRuts((prev) => {
      const next = new Set(prev);
      next.has(rut) ? next.delete(rut) : next.add(rut);
      return next;
    });
  }

  function handleConfirm() {
    if (desde > hasta) {
      setRangeError("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
      return;
    }
    setRangeError(null);
    onConfirm({ desde, hasta, excludedRuts: Array.from(excludedRuts), modo });
  }

  const availableCount = workers.length - excludedRuts.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recalcular parcial</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Optimiza solo el rango seleccionado, sin tocar el resto del mes.
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Rango de fechas */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Rango</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={desde}
                  min={firstDay}
                  max={lastDay}
                  onChange={(e) => { setDesde(e.target.value); setRangeError(null); }}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-gray-400 text-sm mt-4">→</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  min={firstDay}
                  max={lastDay}
                  onChange={(e) => { setHasta(e.target.value); setRangeError(null); }}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {rangeError && (
              <p className="mt-1.5 text-xs text-red-600">{rangeError}</p>
            )}
          </div>

          {/* Lista de workers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Dotación disponible
              </p>
              <span className="text-xs text-gray-400">
                {availableCount} de {workers.length}
              </span>
            </div>

            {workers.length === 0 ? (
              <p className="text-sm text-gray-400">Sin trabajadores cargados.</p>
            ) : (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {workers.map((w) => {
                  const excluded = excludedRuts.has(w.rut);
                  return (
                    <label
                      key={w.rut}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleWorker(w.rut)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${excluded ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {w.nombre_completo}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modo */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Modo</p>
            <div className="flex items-center gap-4">
              {(["ilp", "greedy"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo"
                    value={m}
                    checked={modo === m}
                    onChange={() => setModo(m)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{m.toUpperCase()}</span>
                  {m === "ilp" && (
                    <span className="text-xs text-gray-400">(óptimo, más lento)</span>
                  )}
                  {m === "greedy" && (
                    <span className="text-xs text-gray-400">(rápido)</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={availableCount === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Calcular propuesta
          </button>
        </div>
      </div>
    </div>
  );
}
