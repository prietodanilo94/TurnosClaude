import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import { getAllPatterns } from "@/lib/patterns/catalog";
import { supervisorLookupKey } from "@/lib/supervisors";
import type { TeamSlice } from "@/lib/calendar/teamSplit";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo } from "@/types";
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
      branch: { select: { id: true, nombre: true, codigo: true } },
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
    include: { supervisor: { select: { nombre: true } } },
  });
  const supervisorKeys = new Set(branchSupervisors.map(sb => supervisorLookupKey(sb.supervisor.nombre)));

  const allPatterns = getAllPatterns();

  interface DisplayBlock {
    key: string;
    title: string;
    areaLabel: string;
    areaNegocio: "ventas" | "postventa";
    categoria: ShiftCategory | null;
    teamIds: string[];
    categoryOptions: { id: string; label: string }[];
    slots: CalendarSlot[];
    assignments: Record<string, string | null>;
    workers: { id: string; nombre: string }[];
    blocks: WorkerBlockInfo[];
    slices: TeamSlice[];
    hasCalendar: boolean;
  }

  const blocks: DisplayBlock[] = [];

  if (isGroup) {
    const byArea = new Map<string, typeof teams>();
    for (const team of teams) {
      if (!byArea.has(team.areaNegocio)) byArea.set(team.areaNegocio, []);
      byArea.get(team.areaNegocio)!.push(team);
    }

    for (const [area, areaTeams] of byArea) {
      const definedCat = areaTeams.find((t) => t.categoria)?.categoria ?? null;

      const allWorkers = areaTeams.flatMap((t) =>
        t.workers
          .filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)))
          .map((w) => ({ id: w.id, nombre: w.nombre })),
      );
      const allBlocks: WorkerBlockInfo[] = areaTeams.flatMap((t) =>
        t.workers
          .filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)))
          .flatMap((w) =>
            w.blocks.map((b) => ({
              id: b.id, workerId: w.id,
              startDate: b.startDate.toISOString().slice(0, 10),
              endDate: b.endDate.toISOString().slice(0, 10),
              motivo: b.motivo,
            })),
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
        } else if (definedCat) {
          teamSlots  = generateCalendar(definedCat as ShiftCategory, year, month, N).slots;
          teamAssign = {};
        } else {
          teamSlots  = [];
          teamAssign = {};
        }

        allSlots.push(...teamSlots.map((s) => ({ ...s, slotNumber: s.slotNumber + offset })));
        for (const [k, v] of Object.entries(teamAssign)) {
          allAssignments[String(Number(k) + offset)] = v;
        }

        slices.push({ teamId: team.id, workerIds: teamWorkers.map((w) => w.id) });
        offset += N;
      }

      const branchNames = [...new Set(areaTeams.map((t) => t.branch.nombre))];
      blocks.push({
        key: area,
        title: branchNames.join(" · "),
        areaLabel: area === "ventas" ? "Ventas" : "Postventa",
        areaNegocio: area as "ventas" | "postventa",
        categoria: definedCat as ShiftCategory | null,
        teamIds: areaTeams.map((t) => t.id),
        categoryOptions: allPatterns.filter((p) => p.areaNegocio === area).map((p) => ({ id: p.id, label: p.label })),
        slots: allSlots,
        assignments: allAssignments,
        workers: allWorkers,
        blocks: allBlocks,
        slices,
        hasCalendar,
      });
    }
  } else {
    for (const team of teams) {
      const teamWorkers = team.workers.filter(w => !supervisorKeys.has(supervisorLookupKey(w.nombre)));
      const cal = team.calendars[0];
      const N   = teamWorkers.length;
      let slots: CalendarSlot[];
      let assignments: Record<string, string | null> = {};

      if (cal) {
        slots       = JSON.parse(cal.slotsData) as CalendarSlot[];
        assignments = JSON.parse(cal.assignments) as Record<string, string | null>;
      } else if (team.categoria) {
        slots = generateCalendar(team.categoria as ShiftCategory, year, month, N).slots;
      } else {
        slots = [];
      }

      const workers = teamWorkers.map((w) => ({ id: w.id, nombre: w.nombre }));
      const allBlocks: WorkerBlockInfo[] = teamWorkers.flatMap((w) =>
        w.blocks.map((b) => ({
          id: b.id, workerId: w.id,
          startDate: b.startDate.toISOString().slice(0, 10),
          endDate: b.endDate.toISOString().slice(0, 10),
          motivo: b.motivo,
        })),
      );

      blocks.push({
        key: team.id,
        title: team.branch.nombre,
        areaLabel: team.areaNegocio === "ventas" ? "Ventas" : "Postventa",
        areaNegocio: team.areaNegocio as "ventas" | "postventa",
        categoria: team.categoria as ShiftCategory | null,
        teamIds: [team.id],
        categoryOptions: allPatterns.filter((p) => p.areaNegocio === team.areaNegocio).map((p) => ({ id: p.id, label: p.label })),
        slots,
        assignments,
        workers,
        blocks: allBlocks,
        slices: [{ teamId: team.id, workerIds: workers.map((w) => w.id) }],
        hasCalendar: !!cal,
      });
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
          title={block.title}
          areaLabel={block.areaLabel}
          areaNegocio={block.areaNegocio}
          categoria={block.categoria}
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
