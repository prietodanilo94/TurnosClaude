import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import { patternFromRow } from "@/lib/patterns/catalog";
import { supervisorLookupKey } from "@/lib/supervisors";
import type { TeamSlice } from "@/lib/calendar/teamSplit";
import type { CalendarSlot, ShiftPatternDef, WorkerBlockInfo } from "@/types";
import SupervisorCalendarView from "./SupervisorCalendarView";

interface Props {
  searchParams: { groupId?: string; branchId?: string | string[]; year?: string; month?: string };
}

export const dynamic = "force-dynamic";

export default async function SupervisorCalendarPage({ searchParams }: Props) {
  const session = await getSession();
  const now = new Date();
  const year  = Number(searchParams.year  ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const allowedBranchIds =
    session?.role === "admin"
      ? (await prisma.branch.findMany({ select: { id: true } })).map((b) => b.id)
      : session?.supervisorId
        ? (await prisma.supervisorBranch.findMany({ where: { supervisorId: session.supervisorId }, select: { branchId: true } })).map((r) => r.branchId)
        : session?.branchIds ?? [];

  let selectedBranchIds: string[] = [];
  let pageTitle = "Calendario";
  let isGroup = false;

  if (searchParams.groupId) {
    const group = await prisma.branchGroup.findUnique({
      where: { id: searchParams.groupId },
      include: { branches: { select: { id: true, nombre: true } } },
    });
    if (!group) notFound();
    const accessible = group.branches.filter((b) => allowedBranchIds.includes(b.id));
    if (accessible.length === 0) {
      return (
        <CalendarAccessNotice
          title="No tienes acceso a este grupo"
          detail="El grupo existe, pero no contiene sucursales asignadas a tu usuario. Pide a RRHH o al administrador revisar tu acceso."
        />
      );
    }
    selectedBranchIds = accessible.map((b) => b.id);
    pageTitle = group.nombre;
    isGroup = true;
  } else {
    const raw = Array.isArray(searchParams.branchId) ? searchParams.branchId : searchParams.branchId ? [searchParams.branchId] : [];
    selectedBranchIds = raw.length > 0 ? raw : allowedBranchIds;
    if (selectedBranchIds.some((id) => !allowedBranchIds.includes(id))) {
      return (
        <CalendarAccessNotice
          title="No tienes acceso a una de las sucursales"
          detail="La URL incluye una sucursal que no esta asignada a tu usuario. Vuelve a Mis sucursales o solicita revision de permisos."
        />
      );
    }
    isGroup = selectedBranchIds.length > 1;
  }

  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  const queryParams = new URLSearchParams();
  if (searchParams.groupId) {
    queryParams.set("groupId", searchParams.groupId);
  } else {
    for (const branchId of selectedBranchIds) {
      queryParams.append("branchId", branchId);
    }
  }
  const queryBase = queryParams.toString();

  const teams = await prisma.branchTeam.findMany({
    where: { branchId: { in: selectedBranchIds } },
    include: {
      branch: { select: { id: true, nombre: true, codigo: true, groupId: true } },
      workers: {
        where: { activo: true, esVirtual: false },
        orderBy: { nombre: "asc" },
        include: {
          blocks: { where: { startDate: { lte: monthEnd }, endDate: { gte: monthStart } } },
        },
      },
      calendars: { where: { year, month } },
    },
    orderBy: [{ branch: { nombre: "asc" } }, { areaNegocio: "asc" }],
  });

  // Bug 6: excluir supervisores del listado de trabajadores
  const branchSupervisors = await prisma.supervisorBranch.findMany({
    where: { branchId: { in: selectedBranchIds } },
    include: { supervisor: { select: { nombre: true, invisible: true } } },
  });
  const supervisorKeys = new Set(branchSupervisors.map(sb => supervisorLookupKey(sb.supervisor.nombre)));
  const supervisorsByBranch = new Map<string, string[]>();
  for (const sb of branchSupervisors) {
    if (sb.supervisor.invisible) continue; // no mostrar supervisores invisibles en el calendario
    if (!supervisorsByBranch.has(sb.branchId)) supervisorsByBranch.set(sb.branchId, []);
    supervisorsByBranch.get(sb.branchId)!.push(sb.supervisor.nombre);
  }

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const prevMonthLabel = `${MONTHS_ES[prevMonth - 1]} ${prevYear}`;

  const teamIds = teams.map((t) => t.id);
  const prevCalendars = teamIds.length > 0
    ? await prisma.calendar.findMany({
        where: { branchTeamId: { in: teamIds }, year: prevYear, month: prevMonth },
        select: { branchTeamId: true, assignments: true },
      })
    : [];
  const prevCalMap = new Map(prevCalendars.map((c) => [c.branchTeamId, c]));

  const supervisorId = session?.supervisorId ?? null;
  const allDbPatterns = await prisma.shiftPattern.findMany({
    where: supervisorId
      ? { OR: [{ supervisorId: null }, { supervisorId }] }
      : { supervisorId: null },
    orderBy: [{ supervisorId: "asc" }, { createdAt: "asc" }],
  });
  const patternMap: Record<string, ShiftPatternDef> = Object.fromEntries(
    allDbPatterns.map((r) => [r.id, patternFromRow(r)]),
  );

  interface DisplayBlock {
    key: string;
    title: string;
    areaLabel: string;
    areaNegocio: "ventas" | "postventa";
    categoria: string | null;
    teamIds: string[];
    categoryOptions: { id: string; label: string; isCustom?: boolean }[];
    slots: CalendarSlot[];
    assignments: Record<string, string | null>;
    workers: { id: string; nombre: string }[];
    blocks: WorkerBlockInfo[];
    slices: TeamSlice[];
    hasCalendar: boolean;
    patternOverride?: ShiftPatternDef;
    prevAssignments?: Record<string, string | null>;
    prevMonthLabel?: string;
    supervisorNames?: string[];
  }

  const blocks: DisplayBlock[] = [];

  function buildGroupBlock(groupTeams: typeof teams, groupTitle: string, blockKey: string) {
    const byArea = new Map<string, typeof teams>();
    for (const team of groupTeams) {
      if (!byArea.has(team.areaNegocio)) byArea.set(team.areaNegocio, []);
      byArea.get(team.areaNegocio)!.push(team);
    }
    for (const [area, areaTeams] of byArea) {
      const definedCat = areaTeams.find((t) => t.categoria)?.categoria ?? null;
      const allWorkers = areaTeams.flatMap((t) =>
        t.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre))).map((w) => ({ id: w.id, nombre: w.nombre })),
      );
      const allWorkerBlocks: WorkerBlockInfo[] = areaTeams.flatMap((t) =>
        t.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre))).flatMap((w) =>
          w.blocks.map((b) => ({ id: b.id, workerId: w.id, startDate: b.startDate.toISOString().slice(0, 10), endDate: b.endDate.toISOString().slice(0, 10), motivo: b.motivo })),
        ),
      );
      let offset = 0;
      const allSlots: CalendarSlot[] = [];
      const allAssignments: Record<string, string | null> = {};
      const slices: TeamSlice[] = [];
      let hasCalendar = false;
      for (const team of areaTeams) {
        const teamWorkers = team.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)));
        const N = teamWorkers.length;
        const cal = team.calendars[0];
        if (cal) hasCalendar = true;
        let teamSlots: CalendarSlot[];
        let teamAssign: Record<string, string | null>;
        if (cal) {
          teamSlots  = JSON.parse(cal.slotsData) as CalendarSlot[];
          teamAssign = JSON.parse(cal.assignments) as Record<string, string | null>;
          // Auto-agregar slots para trabajadores nuevos
          if (N > teamSlots.length && definedCat) {
            const full = generateCalendar(definedCat, year, month, N, patternMap[definedCat]);
            teamSlots = [...teamSlots, ...full.slots.slice(teamSlots.length)];
          }
        } else if (definedCat) {
          teamSlots  = generateCalendar(definedCat, year, month, N, patternMap[definedCat]).slots;
          teamAssign = {};
        } else {
          teamSlots  = [];
          teamAssign = {};
        }
        allSlots.push(...teamSlots.map((s) => ({ ...s, slotNumber: s.slotNumber + offset })));
        for (const [k, v] of Object.entries(teamAssign)) allAssignments[String(Number(k) + offset)] = v;
        slices.push({ teamId: team.id, workerIds: teamWorkers.map((w) => w.id), slotCount: teamSlots.length });
        // El offset del siguiente equipo debe avanzar segun la cantidad real
        // de slots agregados a allSlots (teamSlots.length), no la cantidad de
        // trabajadores activos hoy (N). Si el calendario guardado tiene mas
        // slots que activos actuales (alguien fue desactivado sin regenerar),
        // usar N aqui produce numeros de slot que chocan con el equipo
        // siguiente — mismo slot combinado asignado a dos trabajadores.
        offset += teamSlots.length;
      }
      blocks.push({
        key: `${blockKey}-${area}`,
        title: groupTitle,
        areaLabel: area === "ventas" ? "Ventas" : "Postventa",
        areaNegocio: area as "ventas" | "postventa",
        categoria: definedCat,
        teamIds: areaTeams.map((t) => t.id),
        categoryOptions: allDbPatterns.filter((p) => p.areaNegocio === area).map((p) => ({ id: p.id, label: p.label, isCustom: p.supervisorId !== null })),
        slots: allSlots,
        assignments: allAssignments,
        workers: allWorkers,
        blocks: allWorkerBlocks,
        slices,
        hasCalendar,
        patternOverride: definedCat ? patternMap[definedCat] : undefined,
        supervisorNames: [...new Set(areaTeams.flatMap((t) => supervisorsByBranch.get(t.branchId) ?? []))],
      });
    }
  }

  function buildSoloBlock(team: (typeof teams)[0]) {
    const teamWorkers = team.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)));
    const cal = team.calendars[0];
    const N   = teamWorkers.length;
    const prevCal = prevCalMap.get(team.id);
    const teamPrevAssignments: Record<string, string | null> = prevCal ? JSON.parse(prevCal.assignments) : {};
    let slots: CalendarSlot[];
    let assignments: Record<string, string | null> = {};
    if (cal) {
      slots       = JSON.parse(cal.slotsData) as CalendarSlot[];
      assignments = JSON.parse(cal.assignments) as Record<string, string | null>;
      // Auto-agregar slots para trabajadores nuevos
      if (N > slots.length && team.categoria) {
        const full = generateCalendar(team.categoria, year, month, N, patternMap[team.categoria]);
        slots = [...slots, ...full.slots.slice(slots.length)];
      }
    } else if (team.categoria) {
      slots = generateCalendar(team.categoria, year, month, N, patternMap[team.categoria]).slots;
    } else {
      slots = [];
    }
    const workers = teamWorkers.map((w) => ({ id: w.id, nombre: w.nombre }));
    const workerBlocks: WorkerBlockInfo[] = teamWorkers.flatMap((w) =>
      w.blocks.map((b) => ({ id: b.id, workerId: w.id, startDate: b.startDate.toISOString().slice(0, 10), endDate: b.endDate.toISOString().slice(0, 10), motivo: b.motivo })),
    );
    blocks.push({
      key: team.id,
      title: team.branch.nombre,
      areaLabel: team.areaNegocio === "ventas" ? "Ventas" : "Postventa",
      areaNegocio: team.areaNegocio as "ventas" | "postventa",
      categoria: team.categoria,
      teamIds: [team.id],
      categoryOptions: allDbPatterns.filter((p) => p.areaNegocio === team.areaNegocio).map((p) => ({ id: p.id, label: p.label, isCustom: p.supervisorId !== null })),
      slots,
      assignments,
      workers,
      blocks: workerBlocks,
      slices: [{ teamId: team.id, workerIds: workers.map((w) => w.id), slotCount: slots.length }],
      hasCalendar: !!cal,
      patternOverride: team.categoria ? patternMap[team.categoria] : undefined,
      prevAssignments: !cal && Object.keys(teamPrevAssignments).length > 0 ? teamPrevAssignments : undefined,
      prevMonthLabel: !cal && Object.keys(teamPrevAssignments).length > 0 ? prevMonthLabel : undefined,
      supervisorNames: supervisorsByBranch.get(team.branchId) ?? [],
    });
  }

  if (searchParams.groupId) {
    // Single explicit group — merge all teams by area
    buildGroupBlock(teams, pageTitle, searchParams.groupId);
  } else {
    // Detect actual groups among the selected branches
    const teamsByRealGroup = new Map<string, typeof teams>();
    const soloTeams: typeof teams = [];
    for (const team of teams) {
      const gid = team.branch.groupId;
      if (gid) {
        if (!teamsByRealGroup.has(gid)) teamsByRealGroup.set(gid, []);
        teamsByRealGroup.get(gid)!.push(team);
      } else {
        soloTeams.push(team);
      }
    }
    for (const [gid, groupTeams] of teamsByRealGroup) {
      const branchNames = [...new Set(groupTeams.map((t) => t.branch.nombre))];
      buildGroupBlock(groupTeams, branchNames.join(" · "), gid);
    }
    for (const team of soloTeams) {
      buildSoloBlock(team);
    }
  }

  return (
    <div className="p-6 space-y-4">

      {blocks.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-sm text-gray-500">
          No hay equipos para las sucursales seleccionadas.
        </div>
      )}

      {blocks.map((block) => (
        <SupervisorCalendarView
          key={block.key}
          hideExcelExport={session?.role !== "admin"}
          title={block.title}
          areaLabel={block.areaLabel}
          areaNegocio={block.areaNegocio}
          categoria={block.categoria}
          patternOverride={block.patternOverride}
          teamIds={block.teamIds}
          categoryOptions={block.categoryOptions}
          year={year}
          month={month}
          slots={block.slots}
          assignments={block.assignments}
          workers={block.workers}
          blocks={block.blocks}
          slices={block.slices}
          hasCalendar={block.hasCalendar}
          queryBase={queryBase}
          prevMonthLabel={block.prevMonthLabel}
          prevAssignments={block.prevAssignments}
          supervisorNames={block.supervisorNames}
        />
      ))}
    </div>
  );
}

function CalendarAccessNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p-6">
      <div className="bg-white border border-amber-200 rounded-lg p-8 text-center max-w-2xl mx-auto">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-2">{detail}</p>
        <Link href="/supervisor" className="inline-flex mt-4 text-sm font-medium text-blue-600 hover:text-blue-800">
          Volver a Mis sucursales
        </Link>
      </div>
    </div>
  );
}
