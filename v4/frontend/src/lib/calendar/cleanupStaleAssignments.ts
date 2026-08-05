import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

/**
 * Cuando un trabajador se desactiva o elimina, sus asignaciones en
 * calendarios YA GUARDADOS no se actualizan solas — el turno le sigue
 * "perteneciendo" en el JSON de assignments. Si el equipo se ve
 * combinado con otro (grupo), o si el trabajador fue eliminado del
 * todo, esa referencia queda huerfana y se muestra como "?" en la UI.
 *
 * Esta funcion limpia esas referencias solo en meses ESTRICTAMENTE
 * futuros — nunca toca el mes actual ni meses pasados. La asignacion es
 * a nivel de slot/mes completo (no por dia), asi que "limpiar desde hoy"
 * en el mes actual borraria tambien los dias YA TRABAJADOS de ese slot
 * (bug real detectado 2026-08: alguien desactivado a mitad de mes perdia
 * el nombre de dias ya transcurridos). Si de verdad hace falta reasignar
 * el resto del mes actual, es una decision manual del admin, no algo que
 * el sistema deba hacer solo.
 * Debe llamarse cada vez que un worker pasa a activo:false o se elimina.
 */
export async function clearWorkerFromFutureCalendars(
  workerIds: string[],
  branchTeamId?: string,
  req?: NextRequest,
): Promise<number> {
  if (workerIds.length === 0) return 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const calendars = await prisma.calendar.findMany({
    where: {
      ...(branchTeamId ? { branchTeamId } : {}),
      OR: [{ year: { gt: year } }, { year, month: { gt: month } }],
    },
    include: { branchTeam: { select: { branchId: true } } },
  });

  let cleaned = 0;
  for (const cal of calendars) {
    let assignments: Record<string, string | null>;
    try {
      assignments = JSON.parse(cal.assignments) as Record<string, string | null>;
    } catch {
      continue;
    }

    const clearedSlots: string[] = [];
    for (const [slot, workerId] of Object.entries(assignments)) {
      if (workerId && workerIds.includes(workerId)) {
        assignments[slot] = null;
        clearedSlots.push(slot);
      }
    }
    if (clearedSlots.length === 0) continue;

    const assignedCount = Object.values(assignments).filter(Boolean).length;
    await prisma.calendar.update({
      where: { id: cal.id },
      data: { assignments: JSON.stringify(assignments), assignedCount },
    });
    cleaned++;

    // Ninguna mutacion automatica de datos guardados debe ser muda (ver
    // CLAUDE.md, Principios de diseno #3): sin esto, un supervisor ve un
    // "vendedor sin asignar" dias despues sin ninguna pista de por que.
    await logAction({
      action: "calendar.assign",
      entityType: "calendar",
      entityId: cal.id,
      branchId: cal.branchTeam.branchId,
      metadata: {
        teamId: cal.branchTeamId,
        year: cal.year,
        month: cal.month,
        assignedCount,
        source: "worker-cleanup",
        note: `Limpieza automatica: ${clearedSlots.length} slot${clearedSlots.length !== 1 ? "s" : ""} desvinculado${clearedSlots.length !== 1 ? "s" : ""} por desactivacion/cambio de equipo de un trabajador.`,
        workerIds,
      },
      req,
    });
  }

  return cleaned;
}
