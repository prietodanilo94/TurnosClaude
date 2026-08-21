import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { generateCalendar } from "@/lib/calendar/generator";
import { ensureRotationAnchors } from "@/lib/calendar/rotationAnchor";
import { resolveCalendarDisplayCategory, type CalendarCategoryTeam } from "@/lib/calendar/categoryFallback";
import { extractNextMonthHead, extractPrevMonthTail } from "@/lib/calendar/prevMonthTail";
import { blankCombinedCalendar } from "@/lib/calendar/freeSchedule";
import { buildIsoWeeks, fmt } from "./calendar-utils";
import { getSession } from "@/lib/auth/session";
import { supervisorLookupKey } from "@/lib/supervisors";
import { patternFromRow } from "@/lib/patterns/catalog";
import type { CalendarSlot, WorkerBlockInfo } from "@/types";
import CalendarView from "./CalendarView";
import CalendarTabs from "@/components/calendar/CalendarTabs";
import FreeCalendarView from "@/components/calendar/FreeCalendarView";

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
  // Cabeza real del mes siguiente: la ultima semana muestra/valida los dias
  // que se asoman con lo realmente guardado alla.
  const nextMonthShifts = extractNextMonthHead(nextCal, nextYear, nextMonth);

  // Un trabajador puede quedar desactivado (baja, cambio de equipo) mientras
  // su ULTIMA asignacion guardada todavia lo referencia en este calendario.
  // Si el guardado siguiente lo saca del slot, computeCalendarDiff necesita
  // su nombre para armar el historial — sin esto, cae al fallback `?? id` en
  // diff.ts y el RUT/nombre real queda reemplazado por el id interno para
  // siempre en el AuditLog (bug real, reportado 2026-08-20 por Isabel: ids
  // crudos en la columna "Trabajador" de Exportar/Historial).
  const activeWorkerIds = new Set(filteredWorkers.map((w) => w.id));
  const staleWorkerIds = existing
    ? [...new Set(Object.values(JSON.parse(existing.assignments) as Record<string, string | null>).filter(
        (id): id is string => !!id && !activeWorkerIds.has(id),
      ))]
    : [];
  const staleWorkers = staleWorkerIds.length > 0
    ? await prisma.worker.findMany({ where: { id: { in: staleWorkerIds } }, select: { id: true, nombre: true } })
    : [];

  const workerMap = Object.fromEntries([
    ...filteredWorkers.map((worker) => [worker.id, worker.nombre] as const),
    ...staleWorkers.map((worker) => [worker.id, worker.nombre] as const),
  ]);
  const workerBlocks: WorkerBlockInfo[] = filteredWorkers.flatMap((worker) =>
    worker.blocks.map((block) => ({
      id: block.id,
      workerId: worker.id,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      motivo: block.motivo,
    })),
  );

  const savedOrigen: "libre" | null = existing?.origen === "libre" ? "libre" : null;

  // Seed del modo libre: lo guardado si el mes ya es de origen libre; una
  // grilla en blanco (un slot por trabajador) en cualquier otro caso.
  const gridDates = buildIsoWeeks(year, month).flat().map(fmt);
  const blank = blankCombinedCalendar(
    [{ teamId: team.id, workers: filteredWorkers.map((w) => ({ id: w.id, nombre: w.nombre })) }],
    gridDates,
  );
  const libreSlots: CalendarSlot[] = savedOrigen === "libre" && existing
    ? (JSON.parse(existing.slotsData) as CalendarSlot[])
    : blank.slots;
  const libreAssignments: Record<string, string | null> = savedOrigen === "libre" && existing
    ? JSON.parse(existing.assignments)
    : blank.assignments;
  const libreSlices = savedOrigen === "libre" && existing
    ? [{ teamId: team.id, workerIds: filteredWorkers.map((w) => w.id), slotCount: libreSlots.length, rotationAnchors: [] }]
    : blank.slices;

  // ─── Pestana Horario rotativo ──────────────────────────────────────────────
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

  let rotativoContent: React.ReactNode;

  if (!categoryResolution.categoria) {
    rotativoContent = (
      <div className="p-6">
        <p className="text-sm text-orange-600">
          Este equipo no tiene categoria de turno asignada. Puedes asignar una desde Sucursales, o crear el mes en la pestaña Horario libre.
        </p>
      </div>
    );
  } else {
    const anchors = await ensureRotationAnchors(
      filteredWorkers.map((w) => ({ id: w.id, rotationAnchor: w.rotationAnchor })),
    );
    const slotAnchors = anchors.map((a) => a.rotationAnchor);

    let slots: CalendarSlot[];
    let assignments: Record<string, string | null> = {};
    let calendarId: string | undefined;
    let alert: string | undefined;
    // Ya no se auto-continua desde el mes anterior (ver comentario mas
    // abajo) — queda declarado en undefined solo para mantener el tipo del
    // prop que usa CalendarView para el texto del boton "Generar".
    const prevMonthLabel: string | undefined = undefined;

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
      // Auto-agregar slots para trabajadores nuevos. Los slotNumber existentes
      // pueden tener huecos (ej. un slot fantasma eliminado antes) — usar
      // slots.length para numerar los nuevos choca con un slotNumber real ya
      // en uso, dejando el slot duplicado inutilizable (bug real 2026-08,
      // Geely Irarrazaval: 2 vendedoras nuevas, solo quedo 1 cupo asignable).
      // Se sigue tomando la misma cola de `full.slots` (mismo criterio de
      // cuantos y cuales patrones usar), pero renumerada desde el maximo
      // slotNumber real.
      if (filteredWorkers.length > slots.length) {
        const full = generateCalendar(catId, year, month, slotAnchors, patternOverride);
        const maxSlotNumber = slots.reduce((max, s) => Math.max(max, s.slotNumber), 0);
        const newSlots = full.slots.slice(slots.length).map((s, i) => ({ ...s, slotNumber: maxSlotNumber + 1 + i }));
        slots = [...slots, ...newSlots];
      }
    } else {
      // Mes sin guardar: la vista previa arranca SIN nadie asignado. Antes
      // se auto-asignaba en orden alfabetico apenas se abria la pagina (sin
      // que nadie lo pidiera) — eso generaba una semana frontera fantasma:
      // el 31-ago real (horario libre cargado a mano) se combinaba con el
      // resto de la semana generada por el patron limpio y podia superar
      // las 42h para gente que en la realidad nunca trabajo esa semana,
      // mostrando errores de validacion sobre datos que nadie decidio
      // (reportado 2026-08-21, Kia Mall Plaza Tobalaba). La semana frontera
      // sigue mostrando datos reales via prevMonthShifts — esto solo evita
      // rellenar el resto del mes con una suposicion.
      const result = generateCalendar(catId, year, month, slotAnchors, patternOverride);
      slots = result.slots;
      alert = result.alert;
    }

    rotativoContent = (
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
        nextMonthShifts={nextMonthShifts}
        nextAssignments={nextAssignments}
        currentYear={year}
        currentMonth={month}
        supervisorNames={branchSupervisors.filter((sb) => !sb.supervisor.invisible).map((sb) => sb.supervisor.nombre)}
        patternRotation={patternOverride?.rotationWeeks}
        showValidationPanel
        isAdmin={true}
        saveConfirmMessage={savedOrigen === "libre"
          ? "El horario oficial de este mes fue creado en modo LIBRE. Tus cambios se guardarán sobre él. ¿Continuar?"
          : undefined}
        recalculateConfirmMessage={savedOrigen === "libre"
          ? "⚠️ Este mes tiene guardado un HORARIO LIBRE. Regenerar lo eliminará y lo reemplazará por el patrón rotativo. ¿Continuar?"
          : undefined}
      />
    );
  }

  // ─── Modo Horario libre (F11) ──────────────────────────────────────────────
  const session = await getSession();
  const libreContent = (
    <FreeCalendarView
      title={team.branch.nombre}
      areaNegocio={team.areaNegocio as "ventas" | "postventa"}
      year={year}
      month={month}
      slots={libreSlots}
      assignments={libreAssignments}
      slices={libreSlices}
      workers={filteredWorkers.map((w) => ({ id: w.id, nombre: w.nombre }))}
      blocks={workerBlocks}
      savedOrigen={savedOrigen}
      hasCalendar={!!existing}
      scopeLabel={team.branch.nombre}
      scopeType="branch"
      prevMonthShifts={prevMonthShifts}
      nextMonthShifts={nextMonthShifts}
      isAdmin={session?.role === "admin"}
      navigateTarget={{ kind: "admin", branchId: params.id, teamId: team.id }}
    />
  );

  return (
    <CalendarTabs
      savedOrigen={savedOrigen}
      hasCalendar={!!existing}
      rotativo={rotativoContent}
      libre={libreContent}
    />
  );
}
