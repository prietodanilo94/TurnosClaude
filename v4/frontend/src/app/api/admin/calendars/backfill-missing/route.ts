import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import { patternFromRow } from "@/lib/patterns/catalog";
import { logAction } from "@/lib/audit/log";
import type { CalendarSlot, ShiftPatternDef } from "@/types";

// Genera el calendario de (year, month) para todo equipo que aun no lo tenga,
// usando la misma logica de auto-asignacion que el boton "Generar" (worker
// ordenado nombre asc -> slot 1..N). La rotacion nace continua desde el mes
// anterior por construccion (ver lib/week-index.ts), asi que no requiere
// copiar nada de junio a mano.
//
// Fuera de alcance a proposito: equipos que pertenecen a un BranchGroup. Esos
// se generan combinados (varias sucursales en una sola tabla, dividida por
// equipo) via /supervisor/calendario — replicar esa logica aqui es un cambio
// de mayor alcance y mas riesgo de desalinear slots entre sucursales.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { year, month, dryRun } = await req.json();
  if (!year || !month) {
    return NextResponse.json({ error: "Falta year o month" }, { status: 400 });
  }

  const teams = await prisma.branchTeam.findMany({
    include: {
      branch: { select: { id: true, nombre: true, groupId: true } },
      workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
      calendars: { where: { year, month }, select: { id: true } },
    },
  });

  // Algunas categorias no vienen del catalogo estatico sino de un ShiftPattern
  // guardado en la DB (horarios personalizados por supervisor/admin). Mismo
  // patron que usa admin/sucursales/.../page.tsx: buscar por id y convertir
  // con patternFromRow para pasarlo como override.
  const categoriaIds = [...new Set(teams.map((t) => t.categoria).filter((c): c is string => !!c))];
  const dbPatterns = await prisma.shiftPattern.findMany({ where: { id: { in: categoriaIds } } });
  const overrideByCategoria = new Map<string, ShiftPatternDef>(
    dbPatterns.map((row) => [row.id, patternFromRow(row)]),
  );

  const generated: { teamId: string; branch: string; area: string; workerCount: number }[] = [];
  const skippedGrouped: { teamId: string; branch: string }[] = [];
  const skippedNoCategoria: { teamId: string; branch: string }[] = [];
  const skippedNoWorkers: { teamId: string; branch: string }[] = [];
  const failed: { teamId: string; branch: string; error: string }[] = [];

  for (const team of teams) {
    if (team.calendars.length > 0) continue; // ya tiene calendario ese mes

    if (team.branch.groupId) {
      skippedGrouped.push({ teamId: team.id, branch: team.branch.nombre });
      continue;
    }
    if (!team.categoria) {
      skippedNoCategoria.push({ teamId: team.id, branch: team.branch.nombre });
      continue;
    }
    if (team.workers.length === 0) {
      skippedNoWorkers.push({ teamId: team.id, branch: team.branch.nombre });
      continue;
    }

    try {
      const patternOverride = overrideByCategoria.get(team.categoria);
      const { slots } = generateCalendar(team.categoria, year, month, team.workers.length, patternOverride);
      const assignments: Record<string, string | null> = {};
      team.workers.forEach((worker, i) => {
        assignments[String(i + 1)] = worker.id;
      });

      if (!dryRun) {
        const calendar = await prisma.calendar.create({
          data: {
            branchTeamId: team.id,
            year,
            month,
            slotsData: JSON.stringify(slots satisfies CalendarSlot[]),
            assignments: JSON.stringify(assignments),
            assignedCount: team.workers.length,
          },
        });

        await logAction({
          action: "calendar.generate",
          entityType: "calendar",
          entityId: calendar.id,
          branchId: team.branch.id,
          metadata: {
            teamId: team.id,
            year,
            month,
            slotCount: slots.length,
            assignedCount: team.workers.length,
            scopeLabel: team.branch.nombre,
            scopeType: "branch",
            mode: "create",
            source: "backfill-missing",
          },
          req,
        });
      }

      generated.push({
        teamId: team.id,
        branch: team.branch.nombre,
        area: team.areaNegocio,
        workerCount: team.workers.length,
      });
    } catch (err) {
      failed.push({
        teamId: team.id,
        branch: team.branch.nombre,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    generated,
    skippedGrouped,
    skippedNoCategoria,
    skippedNoWorkers,
    failed,
  });
}
