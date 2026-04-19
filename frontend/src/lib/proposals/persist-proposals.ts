import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Worker } from "@/types/models";
import type { OptimizerProposal } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export async function persistProposals(
  proposals: OptimizerProposal[],
  branchId: string,
  year: number,
  month: number,
  workers: Worker[],
  userId: string
): Promise<void> {
  const rutToId = new Map(workers.map((w) => [w.rut, w.$id]));

  await Promise.all(
    proposals.map(async (p) => {
      // Almacenamos slot+date+shift_id+worker_rut para poder reconstruir sin joins.
      const asignacionesJson = JSON.stringify(
        p.asignaciones.map((a) => ({
          slot: a.worker_slot,
          date: a.date,
          shift_id: a.shift_id,
          worker_rut: a.worker_rut,
        }))
      );

      const proposalDoc = await databases.createDocument(
        DB,
        "proposals",
        ID.unique(),
        {
          branch_id: branchId,
          anio: year,
          mes: month,
          modo: p.modo,
          score: p.score,
          factible: p.factible,
          dotacion_sugerida: p.dotacion_minima_sugerida,
          asignaciones: asignacionesJson,
          parametros: JSON.stringify({}),
          estado: "generada",
          creada_por: userId,
          ...(p.metrics && { metrics: JSON.stringify(p.metrics) }),
        }
      );

      // Una asignación por slot único: mapea slot_numero → worker_id (Appwrite $id).
      const slotMap = new Map<number, string>();
      for (const a of p.asignaciones) {
        if (!slotMap.has(a.worker_slot)) {
          slotMap.set(a.worker_slot, a.worker_rut);
        }
      }

      await Promise.all(
        Array.from(slotMap.entries()).map(([slot, rut]) =>
          databases.createDocument(DB, "assignments", ID.unique(), {
            proposal_id: proposalDoc.$id,
            slot_numero: slot,
            worker_id: rutToId.get(rut) ?? rut,
            asignado_en: new Date().toISOString(),
          })
        )
      );
    })
  );
}
