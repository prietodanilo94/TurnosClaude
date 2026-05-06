import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { buildWorkerBlockDateMap, getWorkerBlockReason, generateCalendar } from "@/lib/calendar/generator";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo } from "@/types";
import GenerateButton, { type TeamSlice } from "./GenerateButton";
import PeriodSelector from "./PeriodSelector";
import CategoryPicker from "./CategoryPicker";
import { getAllPatterns } from "@/lib/patterns/catalog";

interface Props {
  searchParams: { groupId?: string; branchId?: string | string[]; year?: string; month?: string };
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shortName(n: string) {
  const p = n.trim().split(/\s+/);
  return p.length <= 1 ? (p[0] ?? "") : `${p[0]} ${p[1].charAt(0)}.`;
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
  const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => new Date(year, month - 1, i + 1));

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

  // ── Agrupar por areaNegocio cuando es grupo ──────────────────────────────
  // Para grupos: siempre un único calendario unificado por área.
  // Para sucursales individuales: un bloque por equipo.

  type TeamRow = { team: typeof teams[0]; slotOffset: number };

  const allPatterns = getAllPatterns();

  interface DisplayBlock {
    key: string;
    title: string;
    areaLabel: string;
    categoria: ShiftCategory | null;
    categoriaSource: string | null;
    teamIds: string[];
    categoryOptions: { id: string; label: string }[];
    teamRows: TeamRow[];
    allSlots: CalendarSlot[];
    allAssignments: Record<string, string | null>;
    allWorkers: { id: string; nombre: string }[];
    allBlocks: WorkerBlockInfo[];
    hasCalendar: boolean;
    slices: TeamSlice[];
  }

  const blocks: DisplayBlock[] = [];

  if (isGroup) {
    // Agrupar por areaNegocio
    const byArea = new Map<string, typeof teams>();
    for (const team of teams) {
      if (!byArea.has(team.areaNegocio)) byArea.set(team.areaNegocio, []);
      byArea.get(team.areaNegocio)!.push(team);
    }

    for (const [area, areaTeams] of byArea) {
      // Resolver categoría: si alguna tiene, usarla; si varias distintas, tomar la primera
      const definedCat = areaTeams.find((t) => t.categoria)?.categoria ?? null;
      const catSource  = definedCat
        ? (areaTeams.find((t) => t.categoria)?.branch.nombre ?? null)
        : null;

      // Combinar workers de todos los equipos (en orden de sucursal)
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

      // Construir slots y assignments globales combinando los calendarios guardados
      // (con offsets de slot por equipo)
      let offset = 0;
      const teamRows: TeamRow[] = [];
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

        // Remap slot numbers to global offset
        const remapped = teamSlots.map((s) => ({ ...s, slotNumber: s.slotNumber + offset }));
        allSlots.push(...remapped);

        for (const [slotStr, wId] of Object.entries(teamAssign)) {
          allAssignments[String(Number(slotStr) + offset)] = wId;
        }

        teamRows.push({ team, slotOffset: offset });
        slices.push({ teamId: team.id, workerIds: team.workers.map((w) => w.id) });
        offset += N;
      }

      const branchNames = [...new Set(areaTeams.map((t) => t.branch.nombre))];
      const areaLabel   = area === "ventas" ? "Ventas" : "Postventa";
      const areaNeg     = area as "ventas" | "postventa";

      blocks.push({
        key: area,
        title: branchNames.join(" · "),
        areaLabel,
        categoria: definedCat as ShiftCategory | null,
        categoriaSource: areaTeams.every((t) => t.categoria) ? null : catSource,
        teamIds: areaTeams.map((t) => t.id),
        categoryOptions: allPatterns.filter((p) => p.areaNegocio === areaNeg).map((p) => ({ id: p.id, label: p.label })),
        teamRows,
        allSlots,
        allAssignments,
        allWorkers,
        allBlocks,
        hasCalendar,
        slices,
      });
    }
  } else {
    // Sucursal individual: un bloque por equipo
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

      const workers  = team.workers.map((w) => ({ id: w.id, nombre: w.nombre }));
      const allBlocks: WorkerBlockInfo[] = team.workers.flatMap((w) =>
        w.blocks.map((b) => ({
          id: b.id, workerId: w.id,
          startDate: b.startDate.toISOString().slice(0, 10),
          endDate: b.endDate.toISOString().slice(0, 10),
          motivo: b.motivo,
        })),
      );

      const areaNeg = team.areaNegocio as "ventas" | "postventa";
      blocks.push({
        key: team.id,
        title: team.branch.nombre,
        areaLabel: areaNeg === "ventas" ? "Ventas" : "Postventa",
        categoria: team.categoria as ShiftCategory | null,
        categoriaSource: null,
        teamIds: [team.id],
        categoryOptions: allPatterns.filter((p) => p.areaNegocio === areaNeg).map((p) => ({ id: p.id, label: p.label })),
        teamRows: [{ team, slotOffset: 0 }],
        allSlots: slots,
        allAssignments: assignments,
        allWorkers: workers,
        allBlocks,
        hasCalendar: !!cal,
        slices: [{ teamId: team.id, workerIds: workers.map((w) => w.id) }],
      });
    }
  }

  const workerMap = Object.fromEntries(
    teams.flatMap((t) => t.workers.map((w) => [w.id, w.nombre])),
  );

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

      {blocks.map((block) => {
        const blockMap = buildWorkerBlockDateMap(block.allBlocks);

        return (
          <div key={block.key} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Cabecera del bloque */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">{block.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{block.areaLabel}</span>
                  <span>·</span>
                  <CategoryPicker
                    teamIds={block.teamIds}
                    current={block.categoria}
                    options={block.categoryOptions}
                  />
                  {!block.hasCalendar && block.categoria && (
                    <span className="text-amber-600 font-medium">· Sin guardar</span>
                  )}
                  <span className="text-gray-400">· {block.allWorkers.length} vendedores</span>
                </div>
              </div>
              {block.categoria && (
                <GenerateButton
                  categoria={block.categoria}
                  year={year}
                  month={month}
                  slices={block.slices}
                  hasCalendar={block.hasCalendar}
                />
              )}
            </div>

            {/* Tabla de slots */}
            {block.allSlots.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400">
                {block.categoria ? "Presiona Generar para crear el calendario." : "Sin categoría asignada."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[180px] sticky left-0 bg-gray-50">Vendedor</th>
                      {days.map((day) => (
                        <th key={fmtDate(day)} className="px-1 py-2 text-center text-gray-500 font-medium min-w-[36px]">
                          {day.getDate()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.allSlots.map((slot) => {
                      const workerId   = block.allAssignments[String(slot.slotNumber)] ?? null;
                      const workerName = workerId ? (workerMap[workerId] ?? "—") : `Slot ${slot.slotNumber}`;
                      return (
                        <tr key={slot.slotNumber} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 sticky left-0 bg-white hover:bg-gray-50">
                            <div className={`text-sm font-medium truncate ${workerId ? "text-gray-900" : "text-gray-400 italic"}`}>
                              {workerName}
                            </div>
                          </td>
                          {days.map((day) => {
                            const dateStr   = fmtDate(day);
                            const shift     = slot.days[dateStr] ?? null;
                            const blockReason = getWorkerBlockReason(blockMap, workerId, dateStr);
                            return (
                              <td key={dateStr} className="px-0.5 py-1 text-center border-l border-gray-100">
                                {blockReason !== null ? (
                                  <div title={blockReason || "Bloqueado"} className="rounded bg-gray-200 text-gray-600 px-0.5 py-0.5 text-[9px]">
                                    Bloq.
                                  </div>
                                ) : shift ? (
                                  <div className="rounded bg-blue-50 text-blue-700 border border-blue-100 px-0.5 py-0.5 text-[9px] leading-tight">
                                    <div>{shift.start}</div>
                                    <div>{shift.end}</div>
                                    {workerId && <div className="opacity-60 truncate">{shortName(workerName)}</div>}
                                  </div>
                                ) : (
                                  <div className="text-gray-200">·</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
