import { prisma } from "@/lib/db/prisma";

const RETENTION_DAYS = 365;

/**
 * Elimina registros de AuditLog con más de RETENTION_DAYS días.
 * Fire-and-forget — llamar con void, no await, para no bloquear la respuesta.
 * Se ejecuta en operaciones de bajo tráfico (ej. dotacion.sync) para evitar
 * un job scheduler separado.
 */
export async function pruneAuditLog(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
