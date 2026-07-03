"use client";

import { Fragment, useEffect, useState } from "react";
import type { CambioRow } from "@/lib/rrhh/cambiosData";

interface Props {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DayChangeRow({ change }: { change: CambioRow["cambios"][0] }) {
  const { dayLabel, from, to } = change;
  const isAdded = !from && !!to;
  const isRemoved = !!from && !to;
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${isAdded ? "bg-green-400" : isRemoved ? "bg-red-400" : "bg-yellow-400"}`} />
      <span className="w-28 text-gray-500 shrink-0">{dayLabel}</span>
      {from ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono whitespace-nowrap">{from}</span> : <span className="text-gray-400 italic">libre</span>}
      <span className="text-gray-400 text-[10px]">→</span>
      {to ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono whitespace-nowrap">{to}</span> : <span className="text-gray-400 italic">libre</span>}
    </div>
  );
}

// F10 fase 5 — modal con todo el historial de cambios de UN trabajador,
// pedido bajo demanda desde /admin/trabajadores. Misma fuente de datos y
// mismo render de detalle que la tabla principal de /admin/exportar-historial.
export default function WorkerHistoryModal({ workerId, workerName, onClose }: Props) {
  const [rows, setRows] = useState<CambioRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rrhh/historial-trabajador?workerId=${workerId}`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el historial");
        return res.json();
      })
      .then((data) => { if (!cancelled) setRows(data.rows); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Error"); });
    return () => { cancelled = true; };
  }, [workerId]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Historial de {workerName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!rows && !error && <p className="text-sm text-gray-400">Cargando…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-gray-400">Sin cambios registrados para este trabajador.</p>}

        {rows && rows.length > 0 && (
          <div className="space-y-1">
            {rows.map((row) => (
              <Fragment key={row.key}>
                <div
                  className="border-t border-gray-100 pt-2 pb-1 first:border-t-0 first:pt-0 cursor-pointer"
                  onClick={() => toggle(row.key)}
                >
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-gray-400">{expanded.has(row.key) ? "▾" : "▸"}</span>
                      <span className="text-gray-500">{fmtDateTime(row.fechaMod)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">{row.modificadoPor}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">{row.eventos} cambio{row.eventos !== 1 ? "s" : ""}</span>
                    </div>
                    {row.fechaDescarga ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 whitespace-nowrap">
                        ✓ Descargado {fmtDateTime(row.fechaDescarga)}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700 whitespace-nowrap">
                        ⚠ Pendiente descarga
                      </span>
                    )}
                  </div>
                  {expanded.has(row.key) && (
                    <div className="pl-4 space-y-0.5">
                      {row.cambios.map((c, i) => <DayChangeRow key={i} change={c} />)}
                    </div>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
