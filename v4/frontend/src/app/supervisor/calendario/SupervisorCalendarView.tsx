"use client";

import { useRef } from "react";
import CalendarView from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView";
import CategoryPicker from "./CategoryPicker";
import { generateCalendar } from "@/lib/calendar/generator";
import { splitCalendarByTeam, type TeamSlice } from "@/lib/calendar/teamSplit";
import { computeCalendarDiff, type ChangeItem } from "@/lib/calendar/diff";
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
  categoryOptions: { id: string; label: string; isCustom?: boolean }[];
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
  supervisorNames?: string[];
  /** Export RRHH (Excel) visible solo para admins */
  hideExcelExport?: boolean;
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
  changes,
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
  changes?: ChangeItem[];
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
      changes: changes ?? null,
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
  supervisorNames,
  hideExcelExport = true,
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

  // Base de comparacion para el diff de cambios: arranca en lo que trajo el
  // server, pero se actualiza tras cada guardado exitoso. Sin esto, guardar
  // dos veces en la misma sesion (ej. sin cerrar la pagina) recalcula el
  // diff contra el estado con el que se abrio la pagina y duplica los mismos
  // cambios en el AuditLog (ver CalendarView.tsx, mismo bug).
  const lastSavedSlots = useRef<CalendarSlot[]>(slots);
  const lastSavedAssignments = useRef<Record<string, string | null>>(assignments);

  const workerMap = Object.fromEntries(workers.map((worker) => [worker.id, worker.nombre]));
  const fullWorkers: WorkerInfo[] = workers.map((worker) => ({
    id: worker.id,
    nombre: worker.nombre,
    rut: "",
    activo: true,
    esVirtual: false,
  }));
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
      hideExcelExport={hideExcelExport}
      enforceValidationBeforeSave
      calendarScopeLabel={title}
      calendarScopeType={slices.length > 1 ? "group" : "branch"}
      supervisorNames={supervisorNames}
      patternRotation={patternOverride?.rotationWeeks}
      changeRemindMessage="Cuidado: estás haciendo cambios en un calendario ya constituido. Los cambios serán informados a RRHH. Para que queden aplicados debes presionar Guardar al terminar. ¿Continuar?"
      prevMonthLabel={!hasCalendar ? prevMonthLabel : undefined}
      onNavigate={(newYear, newMonth) => `/supervisor/calendario?${navigationQueryPrefix}year=${newYear}&month=${newMonth}`}
      onSaveCalendar={async ({ slotsData, assignments: nextAssignments, validationSummary, scopeLabel, scopeType }) => {
        const changes = hasCalendar
          ? computeCalendarDiff(lastSavedSlots.current, slotsData, lastSavedAssignments.current, nextAssignments, workerMap, year, month)
          : undefined;
        await saveTeamCalendars({
          year,
          month,
          slots: slotsData,
          assignments: nextAssignments,
          slices,
          validationSummary,
          scopeLabel,
          scopeType,
          changes,
        });
        lastSavedSlots.current = slotsData;
        lastSavedAssignments.current = nextAssignments;
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

        // Generar por primera vez: mostrar plantilla sin guardar aún (usuario debe presionar Guardar).
        // El ancla de rotacion de cada trabajador (F9) ya garantiza que su
        // semana de rotacion sea la misma que en el mes anterior si sigue
        // activo — no hace falta copiar asignaciones por numero de slot
        // (ese metodo asignaba mal si el equipo habia cambiado en el medio).
        const slotAnchors = slices.flatMap((slice) => slice.rotationAnchors ?? slice.workerIds.map((_, i) => i));
        const generated = generateCalendar(categoria, year, month, slotAnchors, patternOverride ?? undefined);
        const nextAssignments: Record<string, string | null> = {};

        let offset = 0;
        for (const slice of slices) {
          slice.workerIds.forEach((workerId, index) => {
            nextAssignments[String(offset + index + 1)] = workerId;
          });
          offset += slice.slotCount ?? slice.workerIds.length;
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
