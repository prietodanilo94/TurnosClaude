"use client";

import CalendarView from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView";
import { generateCalendar } from "@/lib/calendar/generator";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo, WorkerInfo } from "@/types";

export interface TeamSlice {
  teamId: string;
  workerIds: string[];
}

interface SimpleWorker {
  id: string;
  nombre: string;
}

interface Props {
  title: string;
  areaLabel: string;
  areaNegocio: "ventas" | "postventa";
  categoria: ShiftCategory | null;
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workers: SimpleWorker[];
  blocks: WorkerBlockInfo[];
  slices: TeamSlice[];
  hasCalendar: boolean;
  queryBase: string;
}

function splitByTeam(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  slices: TeamSlice[],
) {
  const result: Array<{
    teamId: string;
    slots: CalendarSlot[];
    assignments: Record<string, string | null>;
  }> = [];

  let offset = 0;
  for (const slice of slices) {
    const workerCount = slice.workerIds.length;
    const teamSlots = slots
      .filter((slot) => slot.slotNumber > offset && slot.slotNumber <= offset + workerCount)
      .map((slot) => ({ ...slot, slotNumber: slot.slotNumber - offset }));

    const teamAssignments: Record<string, string | null> = {};
    for (const [slotNumber, workerId] of Object.entries(assignments)) {
      const numericSlot = Number(slotNumber);
      if (numericSlot > offset && numericSlot <= offset + workerCount) {
        teamAssignments[String(numericSlot - offset)] = workerId;
      }
    }

    result.push({ teamId: slice.teamId, slots: teamSlots, assignments: teamAssignments });
    offset += workerCount;
  }

  return result;
}

async function saveTeamCalendars({
  year,
  month,
  slots,
  assignments,
  slices,
  validationSummary,
}: {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  slices: TeamSlice[];
  validationSummary?: {
    errorCount: number;
    warningCount: number;
    warningCodes: string[];
  };
}) {
  for (const teamData of splitByTeam(slots, assignments, slices)) {
    const res = await fetch("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: teamData.teamId,
        year,
        month,
        slotsData: teamData.slots,
        assignments: teamData.assignments,
        validationSummary,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Error al guardar calendario");
    }
  }
}

export default function SupervisorCalendarView({
  title,
  areaLabel,
  areaNegocio,
  categoria,
  year,
  month,
  slots,
  assignments,
  workers,
  blocks,
  slices,
  hasCalendar,
  queryBase,
}: Props) {
  if (!categoria) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-red-500 mt-1">{areaLabel} · sin categoria</div>
      </div>
    );
  }

  const workerMap = Object.fromEntries(workers.map((worker) => [worker.id, worker.nombre]));
  const fullWorkers: WorkerInfo[] = workers.map((worker) => ({
    id: worker.id,
    nombre: worker.nombre,
    rut: "",
    activo: true,
    esVirtual: false,
  }));
  const totalWorkers = slices.reduce((sum, slice) => sum + slice.workerIds.length, 0);
  const navigationQueryPrefix = queryBase ? `${queryBase}&` : "";

  return (
    <CalendarView
      branchId="supervisor"
      branchName={title}
      branchCodigo={`${slices.length} equipo${slices.length !== 1 ? "s" : ""}`}
      teamId={slices[0]?.teamId ?? "supervisor"}
      areaNegocio={areaNegocio}
      categoria={categoria}
      year={year}
      month={month}
      slots={slots}
      assignments={assignments}
      workers={fullWorkers}
      workerMap={workerMap}
      workerBlocks={blocks}
      calendarId={hasCalendar ? "supervisor-combined" : undefined}
      backHref="/supervisor"
      backLabel="Volver"
      showExportButtons={false}
      enforceValidationBeforeSave
      recalculateLabel={hasCalendar ? "Regenerar" : "Generar"}
      recalculateConfirmMessage={
        hasCalendar
          ? "Esto regenerara el calendario supervisor y guardara los cambios por equipo. Continuar?"
          : "Esto generara el calendario supervisor y asignara vendedores en orden. Continuar?"
      }
      onNavigate={(newYear, newMonth) => `/supervisor/calendario?${navigationQueryPrefix}year=${newYear}&month=${newMonth}`}
      onSaveCalendar={async ({ slotsData, assignments: nextAssignments, validationSummary }) => {
        await saveTeamCalendars({
          year,
          month,
          slots: slotsData,
          assignments: nextAssignments,
          slices,
          validationSummary,
        });
        return "supervisor-combined";
      }}
      onRecalculateCalendar={async () => {
        const generated = generateCalendar(categoria, year, month, totalWorkers);
        const nextAssignments: Record<string, string | null> = {};

        let offset = 0;
        for (const slice of slices) {
          slice.workerIds.forEach((workerId, index) => {
            nextAssignments[String(offset + index + 1)] = workerId;
          });
          offset += slice.workerIds.length;
        }

        await saveTeamCalendars({
          year,
          month,
          slots: generated.slots,
          assignments: nextAssignments,
          slices,
        });

        return {
          slots: generated.slots,
          assignments: nextAssignments,
          calendarId: "supervisor-combined",
        };
      }}
    />
  );
}
