"use client";

import { useState } from "react";
import { useCalendarStore } from "@/store/calendar-store";
import { triggerDownload, ExportError } from "@/lib/export/trigger-download";

export function ExportButton() {
  const violations = useCalendarStore((s) => s.violations);
  const activeProposalId = useCalendarStore((s) => s.activeProposalId);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasViolations = violations.length > 0;
  const disabled = hasViolations || !activeProposalId || loading;

  async function handleExport() {
    if (!activeProposalId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await triggerDownload(activeProposalId);
    } catch (err) {
      if (err instanceof ExportError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Error inesperado al exportar");
      }
    } finally {
      setLoading(false);
    }
  }

  const title = hasViolations
    ? "Corrige las violaciones antes de exportar"
    : !activeProposalId
    ? "No hay propuesta activa"
    : undefined;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={disabled}
        title={title}
        className={[
          "px-4 py-1.5 rounded-md text-sm font-medium border transition-colors",
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
        ].join(" ")}
      >
        {loading ? "Exportando…" : "Exportar Excel"}
      </button>

      {errorMsg && (
        <span className="text-xs text-red-600 max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
