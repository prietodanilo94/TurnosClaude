import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateCalendar } from "@/lib/calendar/generator";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo } from "@/types";
import PeriodSelector from "./PeriodSelector";
import SupervisorCalendarView, { type TeamSlice } from "./SupervisorCalendarView";

interface Props {
  searchParams: { groupId?: string; branchId?: string | string[]; year?: string; month?: string };
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    if (accessible.length === 0) notFound();
    selectedBranchIds = group.branches.map((b) => b.id);
    pageTitle = group.nombre;
    isGroup = true;
  } else {
    const raw = Array.isArray(searchParams.branchId) ? searchParams.branchId : searchParams.branchId ? [searchParams.branchId] : [];
    selectedBranchIds = raw.length > 0 ? raw : allowedBranchIds;
    if (selectedBranchIds.some((id) => !allowedBranchIds.includes(id))) notFound();
    isGroup = selectedBranchIds.length > 1;
  }

  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);
  const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) =>
    fmtDate(new Date(year, month - 1, i + 1)),
  );

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

  interface DisplayBlock {
    key: string;
    title: string;
    areaLabel: string;
    categoria: ShiftCategory | null;
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
        t.workers.map((w) => ({ id: w.id, nombre: w.nombre })),
      );
      const allBlocks: WorkerBlockInfo[] = areaTeams.flatMap((t) =>
        t.workers.flatMap((w) =>
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
        const N = team.workers.length;
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

        slices.push({ teamId: team.id, workerIds: team.workers.map((w) => w.id) });
        offset += N;
      }

      const branchNames = [...new Set(areaTeams.map((t) => t.branch.nombre))];
      blocks.push({
        key: area,
        title: branchNames.join(" · "),
        areaLabel: area === "ventas" ? "Ventas" : "Postventa",
        categoria: definedCat as ShiftCategory | null,
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
      const cal = team.calendars[0];
      const N   = team.workers.length;
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

      const workers = team.workers.map((w) => ({ id: w.id, nombre: w.nombre }));
      const allBlocks: WorkerBlockInfo[] = team.workers.flatMap((w) =>
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
        categoria: team.categoria as ShiftCategory | null,
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedBranchIds.length} sucursal{selectedBranchIds.length !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense>
            <PeriodSelector year={year} month={month} />
          </Suspense>
          <Link href="/supervisor" className="text-sm text-blue-600 hover:text-blue-800">← Volver</Link>
        </div>
      </div>

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
          categoria={block.categoria}
          year={year}
          month={month}
          days={days}
          slots={block.slots}
          assignments={block.assignments}
          workers={block.workers}
          blocks={block.blocks}
          slices={block.slices}
          hasCalendar={block.hasCalendar}
        />
      ))}
    </div>
  );
}
