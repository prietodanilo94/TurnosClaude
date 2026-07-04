import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { ensureRotationAnchors } from "@/lib/calendar/rotationAnchor";
import { resolveCalendarDisplayCategory, type CalendarCategoryTeam } from "@/lib/calendar/categoryFallback";
import { extractPrevMonthTail } from "@/lib/calendar/prevMonthTail";
import { getSession } from "@/lib/auth/session";
import { supervisorLookupKey } from "@/lib/supervisors";
import { patternFromRow } from "@/lib/patterns/catalog";
import type { CalendarSlot, WorkerBlockInfo } from "@/types";
import CalendarView from "./CalendarView";

interface Props {
  params: { id: string; year: string; month: string };
  searchParams: { team?: string };
}

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ params, searchParams }: Props) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);

  if (!searchParams.team) notFound();
  await getSession();

  const monthStart = new Date(`${params.year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const team = await prisma.branchTeam.findUnique({
    where: { id: searchParams.team },
    include: {
      branch: true,
      workers: {
        where: { activo: true, esVirtual: false },
        orderBy: { nombre: "asc" },
        include: {
          blocks: {
            where: {
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
            orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
          },
        },
      },
      calendars: { where: { year, month } },
    },
  });

  if (!team || team.branchId !== params.id) notFound();

  // Esta vista es de un solo equipo — nunca combina datos de otras sucursales.
  // Si la sucursal pertenece a un grupo, redirigir a la vista combinada
  // (misma que usan los supervisores) para no exportar/mostrar solo una
  // mitad del grupo sin que el admin se de cuenta.
  if (team.branch.groupId) {
    redirect(`/supervisor/calendario?groupId=${team.branch.groupId}&year=${year}&month=${month}`);
  }

  // Bug 6: obtener supervisores de la sucursal para excluirlos de los trabajadores
  const branchSupervisors = await prisma.supervisorBranch.findMany({
    where: { branchId: params.id },
    include: { supervisor: { select: { nombre: true, invisible: true } } },
  });
  const supervisorKeys = new Set(branchSupervisors.map(sb => supervisorLookupKey(sb.supervisor.nombre)));
  const filteredWorkers = team.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)));

  const existing = team.calendars[0];
  const groupCategoryCandidates =
    !team.categoria && existing && team.branch.groupId
      ? await prisma.branchTeam.findMany({
          where: {
            areaNegocio: team.areaNegocio,
            categoria: { not: null },
            branch: { groupId: team.branch.groupId },
          },
          include: { branch: { select: { groupId: true, nombre: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : [];
  const categoryResolution = resolveCalendarDisplayCategory(
    team as CalendarCategoryTeam,
    groupCategoryCandidates as CalendarCategoryTeam[],
  );

  if (!categoryResolution.categoria) {
    return (
      <div className="p-6">
        <p className="text-sm text-orange-600">Este equipo no tiene categoria de turno asignada.</p>
      </div>
    );
  }

  const anchors = await ensureRotationAnchors(
    filteredWorkers.map((w) => ({ id: w.id, rotationAnchor: w.rotationAnchor })),
  );
  const slotAnchors = anchors.map((a) => a.rotationAnchor);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const [prevCal, nextCal] = await Promise.all([
    prisma.calendar.findFirst({ where: { branchTeamId: team.id, year: prevYear, month: prevMonth } }),
    prisma.calendar.findFirst({ where: { branchTeamId: team.id, year: nextYear, month: nextMonth } }),
  ]);

  const prevAssignments: Record<string, string | null> = prevCal ? JSON.parse(prevCal.assignments) : {};
  const nextAssignments: Record<string, string | null> = nextCal ? JSON.parse(nextCal.assignments) : {};
  // Cola real del mes anterior: la validacion la usa para que rachas y
  // horas de la semana frontera se calculen contra lo realmente guardado.
  const prevMonthShifts = extractPrevMonthTail(prevCal, prevYear, prevMonth);

  let slots: CalendarSlot[];
  let assignments: Record<string, string | null> = {};
  let calendarId: string | undefined;
  let alert: string | undefined;
  let prevMonthLabel: string | undefined;

  const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const catId = categoryResolution.categoria;
  const patternRow = catId ? await prisma.shiftPattern.findUnique({ where: { id: catId } }) : null;
  const patternOverride = patternRow ? patternFromRow(patternRow) : undefined;

  if (existing) {
    slots = JSON.parse(existing.slotsData) as CalendarSlot[];
    assignments = JSON.parse(existing.assignments);
    calendarId = existing.id;
    if (categoryResolution.source === "group") {
      alert = `Este equipo no tiene categoria propia. Se muestra usando la categoria del grupo${categoryResolution.sourceBranchName ? ` desde ${categoryResolution.sourceBranchName}` : ""}.`;
    }
    // Auto-agregar slots para trabajadores nuevos
    if (filteredWorkers.length > slots.length) {
      const full = generateCalendar(catId, year, month, slotAnchors, patternOverride);
      slots = [...slots, ...full.slots.slice(slots.length)];
    }
  } else {
    const result = generateCalendar(catId, year, month, slotAnchors, patternOverride);
    slots = result.slots;
    alert = result.alert;
    if (Object.keys(prevAssignments).length > 0) {
      // El ancla de rotacion de cada trabajador (F9) ya garantiza continuidad
      // con el mes anterior si sigue activo — no se copian asignaciones por
      // numero de slot (podian corresponder a otra persona si el equipo
      // cambio en el medio). Solo se asigna en orden alfabetico actual.
      filteredWorkers.forEach((w, i) => { assignments[String(i + 1)] = w.id; });
      prevMonthLabel = `${MONTHS_ES[prevMonth - 1]} ${prevYear}`;
    }
  }

  const workerMap = Object.fromEntries(filteredWorkers.map((worker) => [worker.id, worker.nombre]));
  const workerBlocks: WorkerBlockInfo[] = filteredWorkers.flatMap((worker) =>
    worker.blocks.map((block) => ({
      id: block.id,
      workerId: worker.id,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      motivo: block.motivo,
    })),
  );

  return (
    <CalendarView
      branchId={params.id}
      branchName={team.branch.nombre}
      branchCodigo={team.branch.codigo}
      teamId={team.id}
      areaNegocio={team.areaNegocio as "ventas" | "postventa"}
      categoria={catId}
      patternOverride={patternOverride}
      year={year}
      month={month}
      slots={slots}
      assignments={assignments}
      workers={filteredWorkers.map((worker) => ({
        id: worker.id,
        nombre: worker.nombre,
        rut: worker.rut,
        activo: worker.activo,
        esVirtual: worker.esVirtual,
      }))}
      workerMap={workerMap}
      workerBlocks={workerBlocks}
      calendarId={calendarId}
      generateAlert={alert}
      prevMonthLabel={prevMonthLabel}
      prevAssignments={prevAssignments}
      prevMonthShifts={prevMonthShifts}
      nextAssignments={nextAssignments}
      currentYear={year}
      currentMonth={month}
      supervisorNames={branchSupervisors.filter((sb) => !sb.supervisor.invisible).map((sb) => sb.supervisor.nombre)}
      patternRotation={patternOverride?.rotationWeeks}
      isAdmin={true}
    />
  );
}
