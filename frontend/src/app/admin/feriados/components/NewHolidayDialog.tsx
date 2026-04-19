"use client";

import { useState } from "react";
import { createHoliday } from "@/lib/holidays/api";
import type { Holiday } from "@/types/models";

interface Props {
  existingDates: Set<string>;
  onCreated: (h: Holiday) => void;
  onClose: () => void;
}

export function NewHolidayDialog({ existingDates, onCreated, onClose }: Props) {
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDuplicate = fecha.length === 10 && existingDates.has(fecha);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDuplicate) return;
    setSaving(true);
    setError(null);
    try {
      const h = await createHoliday({ fecha, nombre });
      onCreated(h);
    } catch {
      setError("No se pudo crear el feriado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Agregar feriado</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {isDuplicate && (
              <p className="text-xs text-red-600 mt-1">Esta fecha ya existe.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              placeholder="Ej: Día de elecciones"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || isDuplicate || !fecha || !nombre}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
