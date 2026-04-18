"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { ProposalCard } from "@/features/proposals/ProposalCard";
import { selectProposal } from "@/lib/proposals/api";
import type { Proposal } from "@/types/models";
import type { OptimizerProposal, ProposalMetrics } from "@/types/optimizer";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

interface SelectClientProps {
  branchId: string;
  year: number;
  month: number;
}

export function SelectClient({ branchId, year, month }: SelectClientProps) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null); // ID de la propuesta en proceso
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const calendarUrl = `/jefe/sucursales/${branchId}/mes/${year}/${month}`;

  const loadProposals = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await databases.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION, [
        Query.equal("branch_id", branchId),
        Query.equal("anio", year),
        Query.equal("mes", month),
        Query.equal("estado", "publicada"),
        Query.orderDesc("score"),
      ]);
      setProposals(result.documents as unknown as Proposal[]);
    } catch {
      setErrorMsg("No se pudieron cargar las propuestas. Intenta recargar la página.");
    } finally {
      setLoading(false);
    }
  }, [branchId, year, month]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  async function handleSelect(proposalId: string) {
    setSelecting(proposalId);
    setErrorMsg(null);
    try {
      await selectProposal(proposalId, branchId, year, month, "jefe_sucursal");
      // Task 11: redirigir al calendario con la propuesta seleccionada
      router.push(`${calendarUrl}?propuesta=${proposalId}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al seleccionar la propuesta.");
      setSelecting(null);
    }
  }

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          {monthLabel} — Sucursal {branchId}
        </h1>
        {!loading && proposals.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Se publicaron {proposals.length} propuesta{proposals.length !== 1 ? "s" : ""}.
            Elige una para empezar a asignar.
          </p>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {errorMsg}
        </div>
      )}

      {/* Estados de carga */}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando propuestas…</p>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center space-y-2">
          <p className="text-sm font-medium text-gray-700">
            No hay propuestas publicadas para este mes.
          </p>
          <p className="text-xs text-gray-500">
            El administrador aún no ha publicado propuestas. Vuelve más tarde.
          </p>
        </div>
      ) : (
        /* Grid de propuestas publicadas */
        <div className="flex flex-wrap gap-4">
          {proposals.map((doc, i) => (
            <ProposalCard
              key={doc.$id}
              proposal={toOptimizerProposal(doc)}
              estado={doc.estado}
              userRole="jefe_sucursal"
              index={i + 1}
              loading={selecting === doc.$id}
              onView={() => router.push(`${calendarUrl}?propuesta=${doc.$id}`)}
              onSelect={() => handleSelect(doc.$id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
