import { prisma } from "@/lib/db/prisma";

export interface WorkerAnchorInput {
  id: string;
  rotationAnchor: number | null;
}

export interface WorkerAnchorResolved {
  id: string;
  rotationAnchor: number;
}

/**
 * Resuelve el ancla de rotacion de cada trabajador (funcion pura, sin DB).
 * Quien ya tiene un ancla guardada la conserva sin importar su posicion
 * actual en la lista. Quien no tiene, recibe su indice dentro de la lista
 * recibida (mismo valor que hoy produce el slotNumber-1 posicional) — pero
 * ese valor debe persistirse (ver ensureRotationAnchors) para que quede
 * fijo de ahi en adelante.
 */
export function resolveRotationAnchors(workers: WorkerAnchorInput[]): WorkerAnchorResolved[] {
  return workers.map((w, i) => ({ id: w.id, rotationAnchor: w.rotationAnchor ?? i }));
}

/**
 * Igual que resolveRotationAnchors, pero ademas persiste en la base de
 * datos el ancla de cualquier trabajador que todavia no tenia una — para
 * que quede fija desde ahora, sin importar como cambie el equipo despues.
 * Es seguro llamarla repetidamente: quien ya tiene ancla no se toca.
 */
export async function ensureRotationAnchors(workers: WorkerAnchorInput[]): Promise<WorkerAnchorResolved[]> {
  const resolved = resolveRotationAnchors(workers);
  const toPersist = resolved.filter((r, i) => workers[i].rotationAnchor === null);

  if (toPersist.length > 0) {
    await Promise.all(
      toPersist.map((w) =>
        prisma.worker.update({ where: { id: w.id }, data: { rotationAnchor: w.rotationAnchor } }),
      ),
    );
  }

  return resolved;
}
