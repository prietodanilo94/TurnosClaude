import { Query } from "appwrite";

import { databases } from "@/lib/auth/appwrite-client";
import type { Proposal, Rol } from "@/types/models";
import { canTransition } from "./state-machine";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";

export async function publishProposal(proposalId: string, userId: string): Promise<void> {
  const doc = (await databases.getDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId)) as unknown as Proposal;

  if (!canTransition(doc.estado, "publicar", "admin")) {
    throw new Error(`No se puede publicar una propuesta en estado "${doc.estado}".`);
  }

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "publicada",
    publicada_por: userId,
    publicada_en: new Date().toISOString(),
  });
}

export async function selectProposal(
  proposalId: string,
  branchId: string,
  year: number,
  month: number,
  userRole: Rol
): Promise<void> {
  // Optimistic check: si otro usuario ya seleccionó entre el fetch y el update
  // tendremos una ventana de raza pequeña, aceptable dado que Appwrite no soporta
  // updates condicionales nativos.
  const doc = (await databases.getDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId)) as unknown as Proposal;

  if (!canTransition(doc.estado, "seleccionar", userRole)) {
    if (doc.estado === "seleccionada") {
      throw new Error(
        "Otro usuario ya seleccionó una propuesta. Recarga para ver el estado actual."
      );
    }
    throw new Error(`No se puede seleccionar una propuesta en estado "${doc.estado}".`);
  }

  // Marcar esta como seleccionada primero (reduce la ventana de raza).
  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "seleccionada",
  });

  // Descartar todas las demás propuestas del mismo (branch, mes).
  const others = (await databases.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION, [
    Query.equal("branch_id", branchId),
    Query.equal("anio", year),
    Query.equal("mes", month),
    Query.notEqual("$id", proposalId),
    Query.notEqual("estado", "descartada"),
  ])) as unknown as { documents: Proposal[] };

  await Promise.all(
    others.documents.map((p) =>
      databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, p.$id, {
        estado: "descartada",
      })
    )
  );
}

export async function discardProposal(proposalId: string, userRole: Rol): Promise<void> {
  const doc = (await databases.getDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId)) as unknown as Proposal;

  if (!canTransition(doc.estado, "descartar", userRole)) {
    throw new Error(`No se puede descartar una propuesta en estado "${doc.estado}".`);
  }

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "descartada",
  });
}

export async function exportProposal(proposalId: string, userRole: Rol): Promise<void> {
  const doc = (await databases.getDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId)) as unknown as Proposal;

  if (!canTransition(doc.estado, "exportar", userRole)) {
    throw new Error(`No se puede exportar una propuesta en estado "${doc.estado}".`);
  }

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "exportada",
  });
}
