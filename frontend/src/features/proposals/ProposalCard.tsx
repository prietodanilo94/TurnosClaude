"use client";

import type { EstadoProposal, Rol } from "@/types/models";
import type { OptimizerProposal } from "@/types/optimizer";
import { allowedActions } from "@/lib/proposals/state-machine";
import { ProposalMetricsView } from "./ProposalMetrics";

interface ProposalCardProps {
  proposal: OptimizerProposal;
  estado: EstadoProposal;
  userRole: Rol;
  index: number;
  loading?: boolean;
  onView?: () => void;
  onPublish?: () => void;
  onSelect?: () => void;
  onDiscard?: () => void;
}

const ESTADO_BADGE: Record<EstadoProposal, { label: string; className: string }> = {
  generada:     { label: "Generada",     className: "bg-gray-100 text-gray-600" },
  publicada:    { label: "Publicada",    className: "bg-blue-100 text-blue-700" },
  seleccionada: { label: "Seleccionada", className: "bg-green-100 text-green-700" },
  exportada:    { label: "Exportada",    className: "bg-purple-100 text-purple-700" },
  descartada:   { label: "Descartada",   className: "bg-red-100 text-red-500" },
};

const ACTION_LABELS: Record<string, string> = {
  publicar:    "Publicar",
  seleccionar: "Elegir esta",
  descartar:   "Descartar",
};

const ACTION_STYLES: Record<string, string> = {
  publicar:    "bg-blue-600 text-white hover:bg-blue-700",
  seleccionar: "bg-green-600 text-white hover:bg-green-700",
  descartar:   "border border-red-300 text-red-600 hover:bg-red-50",
};

export function ProposalCard({
  proposal,
  estado,
  userRole,
  index,
  loading = false,
  onView,
  onPublish,
  onSelect,
  onDiscard,
}: ProposalCardProps) {
  const badge = ESTADO_BADGE[estado];
  const actions = allowedActions(estado, userRole);

  const ACTION_HANDLERS: Record<string, (() => void) | undefined> = {
    publicar:    onPublish,
    seleccionar: onSelect,
    descartar:   onDiscard,
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-3 min-w-[220px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Propuesta {index}{" "}
          <span className="font-normal text-gray-500">({proposal.modo.toUpperCase()})</span>
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Métricas */}
      {proposal.metrics ? (
        <ProposalMetricsView metrics={proposal.metrics} />
      ) : (
        <p className="text-xs text-gray-400 italic">Sin métricas disponibles</p>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={onView}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Ver
        </button>

        {actions.map((action) => {
          const handler = ACTION_HANDLERS[action];
          if (!handler) return null;
          return (
            <button
              key={action}
              onClick={handler}
              disabled={loading}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 ${ACTION_STYLES[action] ?? ""}`}
            >
              {loading ? "…" : ACTION_LABELS[action] ?? action}
            </button>
          );
        })}
      </div>
    </div>
  );
}
