import { ID, Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { WorkerConstraint, TipoConstraint, DiaSemana } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const COLLECTION = "worker_constraints";

export interface CreateExceptionInput {
  worker_id: string;
  tipo: TipoConstraint;
  valor?: string;         // dia_prohibido: DiaSemana | turno_prohibido: shift_id
  fecha_desde?: string;   // vacaciones: ISO date
  fecha_hasta?: string;   // vacaciones: ISO date
  notas?: string;
  creado_por: string;
}

export async function listExceptionsByWorker(workerId: string): Promise<WorkerConstraint[]> {
  const result = await databases.listDocuments(DB, COLLECTION, [
    Query.equal("worker_id", workerId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return result.documents as unknown as WorkerConstraint[];
}

export async function createException(input: CreateExceptionInput): Promise<WorkerConstraint> {
  const doc = await databases.createDocument(DB, COLLECTION, ID.unique(), {
    worker_id: input.worker_id,
    tipo: input.tipo,
    valor: input.valor ?? null,
    fecha_desde: input.fecha_desde ?? null,
    fecha_hasta: input.fecha_hasta ?? null,
    notas: input.notas ?? null,
    creado_por: input.creado_por,
  });
  return doc as unknown as WorkerConstraint;
}

export async function updateException(
  id: string,
  data: Partial<Pick<CreateExceptionInput, "valor" | "fecha_desde" | "fecha_hasta" | "notas">>
): Promise<WorkerConstraint> {
  const doc = await databases.updateDocument(DB, COLLECTION, id, data);
  return doc as unknown as WorkerConstraint;
}

export async function deleteException(id: string): Promise<void> {
  await databases.deleteDocument(DB, COLLECTION, id);
}
