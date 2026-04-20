import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { OptimizerProposal } from "@/types/optimizer";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export async function persistProposals(
  proposals: OptimizerProposal[],
  branchId: string,
  year: number,
  month: number,
  userId: string
): Promise<void> {
  await Promise.all(
    proposals.map(async (p) => {
      // Almacenamos slot+date+shift_id+worker_rut para poder reconstruir sin joins.
      // worker_rut = "worker_N" (anónimo) hasta que el admin aplique el mapeo y guarde.
      const asignacionesJson = JSON.stringify(
        p.asignaciones.map((a) => ({
          slot: a.worker_slot,
          date: a.date,
          shift_id: a.shift_id,
          worker_rut: a.worker_rut,
        }))
      );

      await databases.createDocument(
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
      // Los docs de assignments (slot → worker real) se crean en SaveButton
      // después de que el admin aplique el mapeo de trabajadores.
    })
  );
}
