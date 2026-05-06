import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  buildWorkerBlockDateMap,
  getWorkerBlockReason,
  generateCalendar,
} from "@/lib/calendar/generator";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo } from "@/types";
import GenerateButton from "./GenerateButton";

interface Props {
  searchParams: {
    groupId?: string;
    branchId?: string | string[];
    year?: string;
    month?: string;
  };
}

function fmtDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export const dynamic = "force-dynamic";

export default async function SupervisorCalendarPage({ searchParams }: Props) {
  const session = await getSession();
  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  // Resolver sucursales permitidas para la sesión
  const allowedBranchIds =
    session?.role === "admin"
      ? (await prisma.branch.findMany({ select: { id: true } })).map((b) => b.id)
      : session?.supervisorId
        ? (await prisma.supervisorBranch.findMany({
            where: { supervisorId: session.supervisorId },
            select: { branchId: true },
          })).map((r) => r.branchId)
        : session?.branchIds ?? [];

  // Resolver qué branchIds mostrar
  let selectedBranchIds: string[] = [];
  let pageTitle = "Calendario";
  let backHref = "/supervisor";

  if (searchParams.groupId) {
    const group = await prisma.branchGroup.findUnique({
      where: { id: searchParams.groupId },
      include: { branches: { select: { id: true, nombre: true } } },
    });
    if (!group) notFound();

    // Verificar que el supervisor tenga acceso a al menos una sucursal del grupo
    const accessible = group.branches.filter((b) => allowedBranchIds.includes(b.id));
    if (accessible.length === 0) notFound();

    selectedBranchIds = group.branches.map((b) => b.id);
    pageTitle = group.nombre;
  } else {
    const rawIds = Array.isArray(searchParams.branchId)
      ? searchParams.branchId
      : searchParams.branchId
        ? [searchParams.branchId]
        : [];
    selectedBranchIds = rawIds.length > 0 ? rawIds : allowedBranchIds;
    if (selectedBranchIds.some((id) => !allowedBranchIds.includes(id))) notFound();
  }

  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const dayCount = new Date(year, month, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, i) => new Date(year, month - 1, i + 1));

  const teams = await prisma.branchTeam.findMany({
    where: { branchId: { in: selectedBranchIds } },
    include: {
      branch: true,
      workers: {
        where: { activo: true },
        orderBy: { nombre: "asc" },
        include: {
          blocks: {
            where: { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
            orderBy: [{ startDate: "asc" }],
          },
        },
      },
      calendars: { where: { year, month } },
    },
    orderBy: [{ branch: { nombre: "asc" } }, { areaNegocio: "asc" }],
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedBranchIds.length} sucursal{selectedBranchIds.length !== 1 ? "es" : ""} · {month}/{year}
          </p>
        </div>
        <Link href={backHref} className="text-sm text-blue-600 hover:text-blue-800">
          ← Volver
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-sm text-gray-500">
          No hay equipos para las sucursales seleccionadas.
        </div>
      ) : (
        teams.map((team) => {
          if (!team.categoria) {
            return (
              <div key={team.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900">
                  {team.branch.nombre} · {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                </div>
                <div className="text-xs text-gray-400 mt-1">Sin categoría de turno asignada.</div>
              </div>
            );
          }

          const hasCalendar = !!team.calendars[0];
          let slots: CalendarSlot[];
          let assignments: Record<string, string | null> = {};

          if (hasCalendar) {
            slots = JSON.parse(team.calendars[0].slotsData);
            assignments = JSON.parse(team.calendars[0].assignments);
          } else {
            slots = generateCalendar(team.categoria as ShiftCategory, year, month, team.workers.length).slots;
          }

          const workerMap = Object.fromEntries(team.workers.map((w) => [w.id, w.nombre]));
          const blocks: WorkerBlockInfo[] = team.workers.flatMap((w) =>
            w.blocks.map((b) => ({
              id: b.id,
              workerId: w.id,
              startDate: b.startDate.toISOString().slice(0, 10),
              endDate: b.endDate.toISOString().slice(0, 10),
              motivo: b.motivo,
            })),
          );
          const blockMap = buildWorkerBlockDateMap(blocks);

          return (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{team.branch.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {team.branch.codigo} · {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"} · {team.categoria}
                    {!hasCalendar && <span className="ml-2 text-amber-600 font-medium">Sin guardar</span>}
                  </div>
                </div>
                <GenerateButton
                  teamId={team.id}
                  year={year}
                  month={month}
                  slots={slots}
                  workerCount={team.workers.length}
                  hasCalendar={hasCalendar}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[200px]">Vendedor</th>
                      {days.map((day) => (
                        <th key={fmtDate(day)} className="px-1 py-2 text-center text-gray-500 font-medium min-w-[36px]">
                          {day.getDate()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => {
                      const workerId = assignments[String(slot.slotNumber)] ?? null;
                      const workerName = workerId ? (workerMap[workerId] ?? "—") : `Slot ${slot.slotNumber}`;
                      return (
                        <tr key={slot.slotNumber} className="border-t border-gray-100">
                          <td className="px-3 py-2 align-top">
                            <div className={`text-sm font-medium ${workerId ? "text-gray-900" : "text-gray-400 italic"}`}>
                              {workerName}
                            </div>
                          </td>
                          {days.map((day) => {
                            const dateStr = fmtDate(day);
                            const shift = slot.days[dateStr] ?? null;
                            const blockReason = getWorkerBlockReason(blockMap, workerId, dateStr);
                            return (
                              <td key={dateStr} className="px-1 py-1.5 text-center border-l border-gray-100">
                                {blockReason !== null ? (
                                  <div title={blockReason || "Bloqueado"} className="rounded bg-gray-200 text-gray-600 px-0.5 py-0.5 text-[10px]">
                                    Bloq.
                                  </div>
                                ) : shift ? (
                                  <div className="rounded bg-blue-50 text-blue-700 border border-blue-100 px-0.5 py-0.5 text-[10px] leading-tight">
                                    <div>{shift.start}</div>
                                    <div>{shift.end}</div>
                                    <div className="opacity-70 truncate">{shortName(workerName)}</div>
                                  </div>
                                ) : (
                                  <div className="text-gray-300">-</div>
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
            </div>
          );
        })
      )}
    </div>
  );
}
