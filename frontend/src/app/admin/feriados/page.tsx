"use client";

import { useEffect, useState } from "react";
import { listHolidays, deleteHoliday } from "@/lib/holidays/api";
import { NewHolidayDialog } from "./components/NewHolidayDialog";
import type { Holiday } from "@/types/models";

export default function FeriadosPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    listHolidays()
      .then(setHolidays)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(h: Holiday) {
    setDeletingId(h.$id);
    try {
      await deleteHoliday(h.$id);
      setHolidays((prev) => prev.filter((x) => x.$id !== h.$id));
    } finally {
      setDeletingId(null);
    }
  }

  // Agrupar por año
  const byYear = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    (acc[h.anio] ??= []).push(h);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort();

  const existingDates = new Set(holidays.map((h) => h.fecha));

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Feriados irrenunciables</h1>
        <button
          onClick={() => setShowDialog(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Agregar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : holidays.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay feriados registrados. Carga el seed con{" "}
          <code className="bg-gray-100 px-1 rounded">npm run seed:all</code>.
        </p>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {year}
              </h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {byYear[year].map((h) => (
                  <li key={h.$id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400">{h.fecha}</span>
                      <span className="text-sm text-gray-800">{h.nombre}</span>
                      <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        🔒 irrenunciable
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(h)}
                      disabled={deletingId === h.$id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      {deletingId === h.$id ? "…" : "×"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showDialog && (
        <NewHolidayDialog
          existingDates={existingDates}
          onCreated={(h) => {
            setHolidays((prev) =>
              [...prev, h].sort((a, b) => a.fecha.localeCompare(b.fecha))
            );
            setShowDialog(false);
          }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
