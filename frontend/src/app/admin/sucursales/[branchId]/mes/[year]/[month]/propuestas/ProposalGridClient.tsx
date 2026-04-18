"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { ProposalCard } from "@/features/proposals/ProposalCard";
import { publishProposal, discardProposal } from "@/lib/proposals/api";
import type { Proposal } from "@/types/models";
import type { OptimizerProposal, ProposalMetrics } from "@/types/optimizer";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface ProposalGridClientProps {
  branchId: string;
  year: number;
  month: number;
}

function parseMetrics(raw: string | undefined): ProposalMetrics | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function toOptimizerProposal(doc: Proposal): OptimizerProposal {
  return {
    id: doc.$id,
    modo: doc.modo,
    score: doc.score,
    factible: doc.factible,
    dotacion_minima_sugerida: doc.dotacion_sugerida,
    asignaciones: [],
    metrics: parseMetrics(doc.metrics),
  };
}

export function ProposalGridClient({ branchId, year, month }: ProposalGridClientProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const calendarUrl = `/admin/sucursales/${branchId}/mes/${year}/${month}`;

  const loadProposals = useCallback(async () => {
    setLoadingPage(true);
    setErrorMsg(null);
    try {
      const result = await databases.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION, [
        Query.equal("branch_id", branchId),
        Query.equal("anio", year),
        Query.equal("mes", month),
        Query.notEqual("estado", "descartada"),
        Query.orderDesc("score"),
      ]);
      setProposals(result.documents as unknown as Proposal[]);
    } catch {
      setErrorMsg("No se pudieron cargar las propuestas (bootstrap pendiente).");
      setProposals([]);
    } finally {
      setLoadingPage(false);
    }
  }, [branchId, year, month]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePublishSelected() {
    if (checked.size === 0) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await Promise.all(Array.from(checked).map((id) => publishProposal(id, "admin")));
      setChecked(new Set());
      await loadProposals();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al publicar propuestas.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDiscardAll() {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await Promise.all(proposals.map((p) => discardProposal(p.$id, "admin")));
      await loadProposals();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al descartar propuestas.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDiscard(proposalId: string) {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await discardProposal(proposalId, "admin");
      await loadProposals();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al descartar propuesta.");
    } finally {
      setActionLoading(false);
    }
  }

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Propuestas generadas — {monthLabel}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Sucursal: {branchId}</p>
        </div>
        <button
          onClick={() => router.push(calendarUrl)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Volver al calendario
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {errorMsg}
        </div>
      )}

      {/* Grid de propuestas */}
      {loadingPage ? (
        <p className="text-sm text-gray-500">Cargando propuestas…</p>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay propuestas generadas para este mes.{" "}
          <button onClick={() => router.push(calendarUrl)} className="text-blue-600 hover:underline">
            Generar desde el calendario.
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {proposals.map((doc, i) => {
            const proposal = toOptimizerProposal(doc);
            const isChecked = checked.has(doc.$id);

            return (
              <div key={doc.$id} className="flex flex-col gap-2">
                {/* Checkbox de selección para publicación masiva */}
                {doc.estado === "generada" && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(doc.$id)}
                      disabled={actionLoading}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Publicar
                  </label>
                )}

                <ProposalCard
                  proposal={proposal}
                  estado={doc.estado}
                  userRole="admin"
                  index={i + 1}
                  loading={actionLoading}
                  onView={() => router.push(calendarUrl)}
                  onDiscard={() => handleDiscard(doc.$id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Acciones globales */}
      {!loadingPage && proposals.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <button
            onClick={handlePublishSelected}
            disabled={actionLoading || checked.size === 0}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? "Procesando…" : `Publicar seleccionadas al jefe (${checked.size})`}
          </button>

          <button
            onClick={handleDiscardAll}
            disabled={actionLoading}
            className="px-4 py-2 text-sm font-medium rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Descartar todas
          </button>
        </div>
      )}
    </div>
  );
}
