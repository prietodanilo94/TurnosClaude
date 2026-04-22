"use client";

import { useState } from "react";
import { syncDotacion } from "@/lib/sync-dotacion";
import type { DotacionDiff, SyncReport } from "@/types/dotacion-sync";
import type { ParsedRow } from "@/lib/excel-parser";

interface Props {
  diff: DotacionDiff;
  rows: ParsedRow[];
  onClose: () => void;
  onDone: () => void;
}

export function SyncConfirmDialog({ diff, rows, onClose, onDone }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [report, setReport] = useState<SyncReport | null>(null);

  const nuevos      = diff.workers.filter((w) => w.status === "nuevo").length;
  const actualizados = diff.workers.filter((w) => w.status === "actualizado").length;
  const sinCambios  = diff.workers.filter((w) => w.status === "sin_cambios").length;
  const desactivar  = diff.toDeactivate.length;
  const newBranches = diff.branches.filter((b) => b.isNew).length;

  async function handleSync() {
    setSyncing(true);
    setProgress([]);
    try {
      const result = await syncDotacion(diff, rows, (msg) =>
        setProgress((p) => [...p, msg])
      );
      setReport(result);
    } catch (e: any) {
      setReport({
        creados: 0, actualizados: 0, desactivados: 0, sinCambios: 0,
        errores: [e.message ?? "Error inesperado"],
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Confirmar sincronización</h2>
        </div>

        <div className="px-6 py-4 space-y-3">
          {!report ? (
            <>
              <p className="text-sm text-gray-600">Se aplicarán los siguientes cambios:</p>
              <ul className="text-sm space-y-1.5">
                {newBranches > 0 && <li className="text-amber-700">📁 {newBranches} sucursal(es) nueva(s)</li>}
                <li className="text-green-700">+ {nuevos} trabajador(es) nuevo(s)</li>
                <li className="text-blue-700">↺ {actualizados} trabajador(es) actualizado(s)</li>
                <li className="text-gray-400">= {sinCambios} sin cambios</li>
                {desactivar > 0 && <li className="text-red-600">✕ {desactivar} trabajador(es) a desactivar</li>}
              </ul>

              {syncing && progress.length > 0 && (
                <div className="mt-3 bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto">
                  {progress.map((msg, i) => (
                    <p key={i} className="text-xs text-gray-500">{msg}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Resultado:</p>
              <ul className="text-sm space-y-1">
                <li className="text-green-700">✓ {report.creados} creados</li>
                <li className="text-blue-700">✓ {report.actualizados} actualizados</li>
                <li className="text-red-600">✓ {report.desactivados} desactivados</li>
                <li className="text-gray-400">= {report.sinCambios} sin cambios</li>
              </ul>
              {report.errores.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-1">
                  {report.errores.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {!report ? (
            <>
              <button
                onClick={onClose}
                disabled={syncing}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? "Sincronizando…" : "Sincronizar"}
              </button>
            </>
          ) : (
            <button
              onClick={onDone}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
