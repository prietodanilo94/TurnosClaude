import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { OptimizerProposal } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

export async function persistProposals(
  proposals: OptimizerProposal[],
  branchId: string,
  year: number,
  month: number,
  userId: string
): Promise<void> {
  await Promise.all(
    proposals.map(async (proposal) => {
      const asignacionesJson = JSON.stringify(
        proposal.asignaciones.map((assignment) => ({
          slot: assignment.worker_slot,
          date: assignment.date,
          shift_id: assignment.shift_id,
          worker_rut: assignment.worker_rut,
        }))
      );

      await databases.createDocument(DB, "proposals", ID.unique(), {
        branch_id: branchId,
        anio: year,
        mes: month,
        modo: proposal.modo,
        score: proposal.score,
        factible: proposal.factible,
        dotacion_sugerida: proposal.dotacion_minima_sugerida,
        asignaciones: asignacionesJson,
        parametros: JSON.stringify({}),
        estado: "generada",
        creada_por: userId,
        ...(proposal.metrics && { metrics: JSON.stringify(proposal.metrics) }),
      });
    })
  );
}
