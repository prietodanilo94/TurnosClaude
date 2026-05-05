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

interface Props {
  searchParams: {
    branchId?: string | string[];
    year?: string;
    month?: string;
  };
}

function fmtDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  const branchIds = Array.isArray(searchParams.branchId)
    ? searchParams.branchId
    : searchParams.branchId
      ? [searchParams.branchId]
      : [];

  const allowedBranchIds =
    session?.role === "admin"
      ? (await prisma.branch.findMany({ select: { id: true } })).map((branch) => branch.id)
      : session?.supervisorId
        ? (
            await prisma.supervisorBranch.findMany({
              where: { supervisorId: session.supervisorId },
              select: { branchId: true },
            })
          ).map((item) => item.branchId)
        : session?.branchIds ?? [];

  const selectedBranchIds = branchIds.length > 0 ? branchIds : allowedBranchIds;
  if (selectedBranchIds.some((branchId) => !allowedBranchIds.includes(branchId))) notFound();

  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const dayCount = new Date(year, month, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => new Date(year, month - 1, index + 1));

  const teams = await prisma.branchTeam.findMany({
    where: { branchId: { in: selectedBranchIds } },
    include: {
      branch: true,
      workers: {
        where: { activo: true },
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
    orderBy: [{ branch: { nombre: "asc" } }, { areaNegocio: "asc" }],
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendario combinado</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {selectedBranchIds.length} sucursal{selectedBranchIds.length !== 1 ? "es" : ""} seleccionada{selectedBranchIds.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/supervisor" className="text-sm text-blue-600 hover:text-blue-800">
          Cambiar seleccion
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
                <div className="text-xs text-gray-400 mt-1">Sin categoria de turno asignada.</div>
              </div>
            );
          }

          let slots: CalendarSlot[];
          let assignments: Record<string, string | null> = {};

          if (team.calendars[0]) {
            slots = JSON.parse(team.calendars[0].slotsData);
            assignments = JSON.parse(team.calendars[0].assignments);
          } else {
            const generated = generateCalendar(
              team.categoria as ShiftCategory,
              year,
              month,
              team.workers.length,
            );
            slots = generated.slots;
          }

          const workerMap = Object.fromEntries(team.workers.map((worker) => [worker.id, worker.nombre]));
          const blocks: WorkerBlockInfo[] = team.workers.flatMap((worker) =>
            worker.blocks.map((block) => ({
              id: block.id,
              workerId: worker.id,
              startDate: block.startDate.toISOString().slice(0, 10),
              endDate: block.endDate.toISOString().slice(0, 10),
              motivo: block.motivo,
            })),
          );
          const blockMap = buildWorkerBlockDateMap(blocks);

          return (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">{team.branch.nombre}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {team.branch.codigo} · {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"} · {team.categoria}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[220px]">Slot / Nombre</th>
                      {days.map((day) => (
                        <th key={fmtDate(day)} className="px-2 py-2 text-center text-gray-500 font-medium">
                          {day.getDate()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => {
                      const workerId = assignments[String(slot.slotNumber)] ?? null;
                      const workerName = workerId ? workerMap[workerId] ?? "Sin nombre" : `Slot ${slot.slotNumber}`;
                      return (
                        <tr key={slot.slotNumber} className="border-t border-gray-100">
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium text-gray-900">Slot {slot.slotNumber}</div>
                            <div className="text-gray-500 mt-0.5">{workerName}</div>
                          </td>
                          {days.map((day) => {
                            const dateStr = fmtDate(day);
                            const shift = slot.days[dateStr] ?? null;
                            const blockReason = getWorkerBlockReason(blockMap, workerId, dateStr);
                            return (
                              <td key={dateStr} className="px-1 py-1.5 text-center border-l border-gray-100">
                                {blockReason !== null ? (
                                  <div
                                    title={blockReason || "Bloqueado"}
                                    className="rounded bg-gray-200 text-gray-700 px-1 py-1"
                                  >
                                    <div className="font-medium">Bloq.</div>
                                    <div className="opacity-80">{shortName(workerName)}</div>
                                  </div>
                                ) : shift ? (
                                  <div className="rounded bg-blue-50 text-blue-700 border border-blue-100 px-1 py-1">
                                    <div>{shift.start}-{shift.end}</div>
                                    <div className="opacity-80">{shortName(workerName)}</div>
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
