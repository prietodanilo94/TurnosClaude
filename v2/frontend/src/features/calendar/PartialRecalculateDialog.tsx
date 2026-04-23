"use client";

import { useState } from "react";
import { useCalendarStore } from "@/store/calendar-store";

export interface PartialRecalculateParams {
  desde: string;
  hasta: string;
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
  const lastDay = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;

  const [desde, setDesde] = useState(firstDay);
  const [hasta, setHasta] = useState(lastDay);
  const [excludedRuts, setExcludedRuts] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<"ilp" | "greedy">("ilp");
  const [rangeError, setRangeError] = useState<string | null>(null);

  function toggleWorker(rut: string) {
    setExcludedRuts((prev) => {
      const next = new Set(prev);
      if (next.has(rut)) next.delete(rut);
      else next.add(rut);
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
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Recalcular parcial</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Optimiza solo el rango seleccionado, sin tocar el resto del mes.
          </p>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Rango
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">Desde</label>
                <input
                  type="date"
                  value={desde}
                  min={firstDay}
                  max={lastDay}
                  onChange={(e) => {
                    setDesde(e.target.value);
                    setRangeError(null);
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="mt-4 text-sm text-gray-400">-&gt;</span>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  min={firstDay}
                  max={lastDay}
                  onChange={(e) => {
                    setHasta(e.target.value);
                    setRangeError(null);
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {rangeError && <p className="mt-1.5 text-xs text-red-600">{rangeError}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Dotacion disponible
              </p>
              <span className="text-xs text-gray-400">
                {availableCount} de {workers.length}
              </span>
            </div>

            {workers.length === 0 ? (
              <p className="text-sm text-gray-400">Sin trabajadores cargados.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                {workers.map((w) => {
                  const excluded = excludedRuts.has(w.rut);
                  return (
                    <label
                      key={w.rut}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleWorker(w.rut)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span
                        className={`text-sm ${excluded ? "text-gray-400 line-through" : "text-gray-700"}`}
                      >
                        {w.nombre_completo}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Modo
            </p>
            <div className="flex items-center gap-4">
              {(["ilp", "greedy"] as const).map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="modo"
                    value={m}
                    checked={modo === m}
                    onChange={() => setModo(m)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm capitalize text-gray-700">{m.toUpperCase()}</span>
                  <span className="text-xs text-gray-400">
                    {m === "ilp" ? "(optimo, mas lento)" : "(rapido)"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={availableCount === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            Calcular propuesta
          </button>
        </div>
      </div>
    </div>
  );
}
