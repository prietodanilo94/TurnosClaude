"use client";

import CalendarView from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView";
import CategoryPicker from "./CategoryPicker";
import { generateCalendar } from "@/lib/calendar/generator";
import { splitCalendarByTeam, type TeamSlice } from "@/lib/calendar/teamSplit";
import type { CalendarSlot, ShiftPatternDef, WorkerBlockInfo, WorkerInfo } from "@/types";

interface SimpleWorker {
  id: string;
  nombre: string;
}

interface Props {
  title: string;
  areaLabel: string;
  areaNegocio: "ventas" | "postventa";
  categoria: string | null;
  patternOverride?: ShiftPatternDef;
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
  prevMonthLabel?: string;
  prevAssignments?: Record<string, string | null>;
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
  patternOverride,
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
  prevMonthLabel,
  prevAssignments,
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
      key={`${slices.map((s) => s.teamId).join("-")}-${year}-${month}`}
      branchId="supervisor"
      branchName={title}
      branchCodigo={`${slices.length} equipo${slices.length !== 1 ? "s" : ""}`}
      teamId={slices[0]?.teamId ?? "supervisor"}
      areaNegocio={areaNegocio}
      categoria={categoria}
      patternOverride={patternOverride}
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
      hideExcelExport
      enforceValidationBeforeSave
      calendarScopeLabel={title}
      calendarScopeType={slices.length > 1 ? "group" : "branch"}
      changeRemindMessage="Cuidado: estás haciendo cambios en un calendario ya constituido. Los cambios serán informados a RRHH. Para que queden aplicados debes presionar Guardar al terminar. ¿Continuar?"
      prevMonthLabel={!hasCalendar ? prevMonthLabel : undefined}
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
        const generated = generateCalendar(categoria, year, month, totalWorkers, patternOverride ?? undefined);
        const nextAssignments: Record<string, string | null> = {};

        if (prevAssignments && Object.keys(prevAssignments).length > 0) {
          // Continuar desde mes anterior: copiar asignaciones, null para slots nuevos
          generated.slots.forEach((s) => {
            nextAssignments[String(s.slotNumber)] = prevAssignments[String(s.slotNumber)] ?? null;
          });
        } else {
          let offset = 0;
          for (const slice of slices) {
            slice.workerIds.forEach((workerId, index) => {
              nextAssignments[String(offset + index + 1)] = workerId;
            });
            offset += slice.workerIds.length;
          }
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
