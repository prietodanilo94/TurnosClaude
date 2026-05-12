"use client";

import CalendarView from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView";
import CategoryPicker from "./CategoryPicker";
import { generateCalendar } from "@/lib/calendar/generator";
import { splitCalendarByTeam, type TeamSlice } from "@/lib/calendar/teamSplit";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo, WorkerInfo } from "@/types";

interface SimpleWorker {
  id: string;
  nombre: string;
}

interface Props {
  title: string;
  areaLabel: string;
  areaNegocio: "ventas" | "postventa";
  categoria: ShiftCategory | null;
  teamIds: string[];
  categoryOptions: { id: string; label: string }[];
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

async function saveTeamCalendars({
  year,
  month,
  slots,
  assignments,
  slices,
  validationSummary,
  scopeLabel,
  scopeType,
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
  scopeLabel?: string;
  scopeType?: "branch" | "group";
}) {
  for (const teamData of splitCalendarByTeam(slots, assignments, slices)) {
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
        scopeLabel,
        scopeType,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Error al guardar calendario");
    }
  }

  // Dispara webhook con Excel adjunto (fire-and-forget)
  void fetch("/api/calendars/save-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamIds: slices.map((s) => s.teamId),
      year,
      month,
      scopeLabel,
      scopeType,
    }),
  });
}

export default function SupervisorCalendarView({
  title,
  areaLabel,
  areaNegocio,
  categoria,
  teamIds,
  categoryOptions,
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
      <div className="bg-white border border-amber-200 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-1 mb-3">{areaLabel} · asigna una categoría para generar el calendario</div>
        <CategoryPicker teamIds={teamIds} current={null} options={categoryOptions} />
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
      showExportButtons
      enforceValidationBeforeSave
      calendarScopeLabel={title}
      calendarScopeType={slices.length > 1 ? "group" : "branch"}
      saveConfirmMessage={hasCalendar ? "Precaucion: vas a modificar un calendario ya creado. Los cambios guardados seran notificados a RRHH. Continuar?" : undefined}
      recalculateLabel={hasCalendar ? "Reiniciar" : "Generar"}
      recalculateConfirmMessage={
        hasCalendar
          ? "Esto borrará todas las asignaciones de trabajadores de este mes y dejará los turnos vacíos. ¿Continuar?"
          : "Esto generará el calendario y asignará vendedores en orden. ¿Continuar?"
      }
      onNavigate={(newYear, newMonth) => `/supervisor/calendario?${navigationQueryPrefix}year=${newYear}&month=${newMonth}`}
      onSaveCalendar={async ({ slotsData, assignments: nextAssignments, validationSummary, scopeLabel, scopeType }) => {
        await saveTeamCalendars({
          year,
          month,
          slots: slotsData,
          assignments: nextAssignments,
          slices,
          validationSummary,
          scopeLabel,
          scopeType,
        });
        return "supervisor-combined";
      }}
      onRecalculateCalendar={async ({ currentSlots }) => {
        if (hasCalendar) {
          // Reiniciar: conserva los turnos, borra solo asignaciones
          const emptyAssignments: Record<string, string | null> = {};
          currentSlots.forEach((s) => { emptyAssignments[String(s.slotNumber)] = null; });

          await saveTeamCalendars({
            year,
            month,
            slots: currentSlots,
            assignments: emptyAssignments,
            slices,
            scopeLabel: title,
            scopeType: slices.length > 1 ? "group" : "branch",
          });

          return {
            slots: currentSlots,
            assignments: emptyAssignments,
            calendarId: "supervisor-combined",
          };
        }

        // Generar por primera vez: mostrar plantilla sin guardar aún (usuario debe presionar Guardar)
        const generated = generateCalendar(categoria, year, month, totalWorkers);
        const nextAssignments: Record<string, string | null> = {};

        let offset = 0;
        for (const slice of slices) {
          slice.workerIds.forEach((workerId, index) => {
            nextAssignments[String(offset + index + 1)] = workerId;
          });
          offset += slice.workerIds.length;
        }

        return {
          slots: generated.slots,
          assignments: nextAssignments,
        };
      }}
      onExportCalendar={async (mode) => {
        const params = new URLSearchParams({
          teamIds: slices.map((slice) => slice.teamId).join(","),
          year: String(year),
          month: String(month),
          mode,
          scopeLabel: title,
          scopeType: slices.length > 1 ? "group" : "branch",
        });
        window.open(`/api/calendars/export-group?${params.toString()}`, "_blank");
      }}
    />
  );
}
