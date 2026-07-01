import { prisma } from "@/lib/db/prisma";

/**
 * Cuando un trabajador se desactiva o elimina, sus asignaciones en
 * calendarios YA GUARDADOS no se actualizan solas — el turno le sigue
 * "perteneciendo" en el JSON de assignments. Si el equipo se ve
 * combinado con otro (grupo), o si el trabajador fue eliminado del
 * todo, esa referencia queda huerfana y se muestra como "?" en la UI.
 *
 * Esta funcion limpia esas referencias en calendarios del mes actual
 * o futuros — nunca toca meses ya pasados, que son registro historico.
 * Debe llamarse cada vez que un worker pasa a activo:false o se elimina.
 */
export async function clearWorkerFromFutureCalendars(
  workerIds: string[],
  branchTeamId?: string,
): Promise<number> {
  if (workerIds.length === 0) return 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const calendars = await prisma.calendar.findMany({
    where: {
      ...(branchTeamId ? { branchTeamId } : {}),
      OR: [{ year: { gt: year } }, { year, month: { gte: month } }],
    },
  });

  let cleaned = 0;
  for (const cal of calendars) {
    let assignments: Record<string, string | null>;
    try {
      assignments = JSON.parse(cal.assignments) as Record<string, string | null>;
    } catch {
      continue;
    }

    let changed = false;
    for (const [slot, workerId] of Object.entries(assignments)) {
      if (workerId && workerIds.includes(workerId)) {
        assignments[slot] = null;
        changed = true;
      }
    }
    if (!changed) continue;

    const assignedCount = Object.values(assignments).filter(Boolean).length;
    await prisma.calendar.update({
      where: { id: cal.id },
      data: { assignments: JSON.stringify(assignments), assignedCount },
    });
    cleaned++;
  }

  return cleaned;
}
