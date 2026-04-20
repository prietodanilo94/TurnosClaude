"use client";

import { useState } from "react";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { useCalendarStore } from "@/store/calendar-store";
import { triggerCalendarDownload, ExportError } from "@/lib/export/trigger-download";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export function ExportCalendarButton() {
  const branchId     = useCalendarStore((s) => s.branchId);
  const year         = useCalendarStore((s) => s.year);
  const month        = useCalendarStore((s) => s.month);
  const workers      = useCalendarStore((s) => s.workers);
  const assignments  = useCalendarStore((s) => s.assignments);
  const shiftCatalog = useCalendarStore((s) => s.shiftCatalog);

  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disabled = assignments.length === 0 || loading;

  async function handleExport() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const branchDoc = await databases.getDocument(DB, "branches", branchId);

      const shiftMap = Object.fromEntries(shiftCatalog.map((s) => [s.id, s]));

      // Mapeo slot -> nombre real del trabajador (si está asignado)
      const workerByRut = Object.fromEntries(workers.map((w) => [w.rut, w]));
      const slotNombre: Record<number, string> = {};
      for (const a of assignments) {
        if (!slotNombre[a.worker_slot]) {
          const w = workerByRut[a.worker_rut];
          slotNombre[a.worker_slot] = w
            ? w.nombre_completo.split(" ").slice(0, 2).join(" ")
            : `Trabajador ${a.worker_slot}`;
        }
      }

      const workersList = Array.from({ length: workers.length }, (_, i) => ({
        slot: i + 1,
        nombre: slotNombre[i + 1] ?? `Trabajador ${i + 1}`,
      }));

      const assignmentsList = assignments
        .map((a) => {
          const shift = shiftMap[a.shift_id];
          if (!shift) return null;
          return { slot: a.worker_slot, date: a.date, inicio: shift.inicio, fin: shift.fin };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      await triggerCalendarDownload({
        branch_nombre: (branchDoc as unknown as { nombre: string }).nombre,
        codigo_area:   (branchDoc as unknown as { codigo_area: string }).codigo_area,
        year,
        month,
        workers:     workersList,
        assignments: assignmentsList,
      });
    } catch (err) {
      setErrorMsg(err instanceof ExportError ? err.message : "Error al exportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={disabled}
        title={disabled && assignments.length === 0 ? "No hay asignaciones" : undefined}
        className={[
          "px-4 py-1.5 rounded-md text-sm font-medium border transition-colors",
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
        ].join(" ")}
      >
        {loading ? "Exportando…" : "Exportar Calendario"}
      </button>
      {errorMsg && (
        <span className="text-xs text-red-600 max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
