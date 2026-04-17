"use client";

import { useState } from "react";
import { useCalendarStore } from "@/store/calendar-store";

const OPTIMIZER_URL = process.env.NEXT_PUBLIC_OPTIMIZER_URL ?? "http://localhost:8000";

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
      const res = await fetch(`${OPTIMIZER_URL}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: activeProposalId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      }

      // Disparar descarga del binario .xlsx
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `turnos_${activeProposalId}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al exportar");
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
