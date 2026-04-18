import { ID, Query } from "appwrite";

import { databases } from "@/lib/auth/appwrite-client";
import type { EstadoProposal, Proposal, Rol } from "@/types/models";
import { canTransition } from "./state-machine";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
const PROPOSALS_COLLECTION = "proposals";
const AUDIT_LOG_COLLECTION = "audit_log";

// ─── Audit log (best-effort: nunca bloquea la operación principal) ─────────────

async function writeAuditLog(
  userId: string,
  accion: string,
  proposalId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await databases.createDocument(DATABASE_ID, AUDIT_LOG_COLLECTION, ID.unique(), {
      user_id: userId,
      accion,
      entidad: "proposals",
      entidad_id: proposalId,
      metadata: JSON.stringify(metadata),
    });
  } catch {
    // No propagar el error: el audit log nunca debe interrumpir la operación.
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function publishProposal(
  proposalId: string,
  userId: string
): Promise<void> {
  const doc = (await databases.getDocument(
    DATABASE_ID, PROPOSALS_COLLECTION, proposalId
  )) as unknown as Proposal;

  if (!canTransition(doc.estado, "publicar", "admin")) {
    throw new Error(`No se puede publicar una propuesta en estado "${doc.estado}".`);
  }

  const estadoAnterior: EstadoProposal = doc.estado;

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "publicada",
    publicada_por: userId,
    publicada_en: new Date().toISOString(),
  });

  await writeAuditLog(userId, "proposal.publicar", proposalId, {
    estado_anterior: estadoAnterior,
    estado_nuevo: "publicada",
  });
}

export async function selectProposal(
  proposalId: string,
  branchId: string,
  year: number,
  month: number,
  userRole: Rol,
  userId = "system"
): Promise<void> {
  // Optimistic check: si otro usuario ya seleccionó entre el fetch y el update
  // tendremos una ventana de raza pequeña, aceptable dado que Appwrite no soporta
  // updates condicionales nativos.
  const doc = (await databases.getDocument(
    DATABASE_ID, PROPOSALS_COLLECTION, proposalId
  )) as unknown as Proposal;

  if (!canTransition(doc.estado, "seleccionar", userRole)) {
    if (doc.estado === "seleccionada") {
      throw new Error(
        "Otro usuario ya seleccionó una propuesta. Recarga para ver el estado actual."
      );
    }
    throw new Error(`No se puede seleccionar una propuesta en estado "${doc.estado}".`);
  }

  const estadoAnterior: EstadoProposal = doc.estado;

  // Marcar esta como seleccionada primero (reduce la ventana de raza).
  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "seleccionada",
  });

  await writeAuditLog(userId, "proposal.seleccionar", proposalId, {
    estado_anterior: estadoAnterior,
    estado_nuevo: "seleccionada",
    user_role: userRole,
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
    others.documents.map(async (p) => {
      await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, p.$id, {
        estado: "descartada",
      });
      await writeAuditLog(userId, "proposal.descartar_por_seleccion", p.$id, {
        estado_anterior: p.estado,
        estado_nuevo: "descartada",
        seleccionada_id: proposalId,
      });
    })
  );
}

export async function discardProposal(
  proposalId: string,
  userRole: Rol,
  userId = "system"
): Promise<void> {
  const doc = (await databases.getDocument(
    DATABASE_ID, PROPOSALS_COLLECTION, proposalId
  )) as unknown as Proposal;

  if (!canTransition(doc.estado, "descartar", userRole)) {
    throw new Error(`No se puede descartar una propuesta en estado "${doc.estado}".`);
  }

  const estadoAnterior: EstadoProposal = doc.estado;

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "descartada",
  });

  await writeAuditLog(userId, "proposal.descartar", proposalId, {
    estado_anterior: estadoAnterior,
    estado_nuevo: "descartada",
    user_role: userRole,
  });
}

export async function exportProposal(
  proposalId: string,
  userRole: Rol,
  userId = "system"
): Promise<void> {
  const doc = (await databases.getDocument(
    DATABASE_ID, PROPOSALS_COLLECTION, proposalId
  )) as unknown as Proposal;

  if (!canTransition(doc.estado, "exportar", userRole)) {
    throw new Error(`No se puede exportar una propuesta en estado "${doc.estado}".`);
  }

  const estadoAnterior: EstadoProposal = doc.estado;

  await databases.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION, proposalId, {
    estado: "exportada",
  });

  await writeAuditLog(userId, "proposal.exportar", proposalId, {
    estado_anterior: estadoAnterior,
    estado_nuevo: "exportada",
    user_role: userRole,
  });
}
