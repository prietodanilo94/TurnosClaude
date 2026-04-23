import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Worker } from "@/types/models";
import type { OptimizerProposal } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";
const ASSIGNMENTS_COLLECTION = "assignments";

export async function persistProposals(
  proposals: OptimizerProposal[],
  branchId: string,
  year: number,
  month: number,
  userId: string,
  workers: Worker[]
): Promise<void> {
  const rutToId = new Map(workers.map((worker) => [worker.rut, worker.$id]));

  await Promise.all(
    proposals.map(async (proposal, index) => {
      const asignacionesJson = JSON.stringify(
        proposal.asignaciones.map((assignment) => ({
          slot: assignment.worker_slot,
          date: assignment.date,
          shift_id: assignment.shift_id,
          worker_rut: assignment.worker_rut,
        }))
      );

      const proposalDoc = await databases.createDocument(DB, "proposals", ID.unique(), {
        branch_id: branchId,
        anio: year,
        mes: month,
        modo: proposal.modo,
        score: proposal.score,
        factible: proposal.factible,
        dotacion_sugerida: proposal.dotacion_minima_sugerida,
        asignaciones: asignacionesJson,
        parametros: JSON.stringify({}),
        estado: index === 0 ? "seleccionada" : "generada",
        creada_por: userId,
        ...(index === 0 && { seleccionada_por: userId }),
        ...(proposal.metrics && { metrics: JSON.stringify(proposal.metrics) }),
      });

      const slotAssignments = new Map<number, string>();
      for (const assignment of proposal.asignaciones) {
        if (!slotAssignments.has(assignment.worker_slot)) {
          slotAssignments.set(assignment.worker_slot, assignment.worker_rut);
        }
      }

      await Promise.all(
        Array.from(slotAssignments.entries()).map(([slot, workerRut]) => {
          const workerId = rutToId.get(workerRut);
          if (!workerId) {
            throw new Error(`No existe worker_id para el RUT ${workerRut}.`);
          }
          return databases.createDocument(DB, ASSIGNMENTS_COLLECTION, ID.unique(), {
            proposal_id: proposalDoc.$id,
            slot_numero: slot,
            worker_id: workerId,
            asignado_por: userId,
            asignado_en: new Date().toISOString(),
          });
        })
      );
    })
  );
}
