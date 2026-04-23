import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Proposal } from "@/types/models";
import type { OptimizerProposal, ProposalMetrics } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

interface StoredSlot {
  slot: number;
  date: string;
  shift_id: string;
  worker_rut?: string;
}

export async function fetchProposals(
  branchId: string,
  year: number,
  month: number
): Promise<OptimizerProposal[]> {
  const result = await databases.listDocuments(DB, "proposals", [
    Query.equal("branch_id", branchId),
    Query.equal("anio", year),
    Query.equal("mes", month),
    Query.notEqual("estado", "descartada"),
    Query.orderDesc("score"),
    Query.limit(10),
  ]);

  const out: OptimizerProposal[] = [];

  for (const doc of result.documents) {
    const p = doc as unknown as Proposal;

    let slots: StoredSlot[] = [];
    try {
      slots = JSON.parse(p.asignaciones as unknown as string);
    } catch {
      continue;
    }

    const asignaciones = slots
      .filter((s) => s.worker_rut)
      .map((s) => ({
        worker_slot: s.slot,
        worker_rut: s.worker_rut!,
        date: s.date,
        shift_id: s.shift_id,
      }));

    if (asignaciones.length === 0) continue;

    let metrics: ProposalMetrics | undefined;
    if (p.metrics) {
      try {
        metrics = JSON.parse(p.metrics);
      } catch {
        // ignore
      }
    }

    out.push({
      id: p.$id,
      modo: p.modo,
      score: p.score,
      factible: p.factible,
      dotacion_minima_sugerida: p.dotacion_sugerida,
      asignaciones,
      ...(metrics && { metrics }),
    });
  }

  return out;
}
