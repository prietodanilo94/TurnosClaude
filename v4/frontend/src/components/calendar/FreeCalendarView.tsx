"use client";

// F11 — modo "Horario libre" montado sobre el CalendarView real: misma
// interfaz que el calendario rotativo (3 pestanas internas, colores, menu
// de edicion por celda, Hrs Sem, drag de turnos entre dias), pero parte en
// blanco y guarda con origen "libre". Reemplaza al editor de grilla propia
// de la primera iteracion, por pedido del usuario (2026-07-05).
import { useRef } from "react";
import CalendarView from "@/app/admin/sucursales/[id]/calendario/[year]/[month]/CalendarView";
import { splitCalendarByTeam, type TeamSlice } from "@/lib/calendar/teamSplit";
import { computeCalendarDiff, type ChangeItem } from "@/lib/calendar/diff";
import type { PrevMonthShiftsMap } from "@/lib/calendar/validation";
import { SHIFT_WINDOW_START, SHIFT_WINDOW_END } from "@/lib/calendar/validation";
import type { CalendarSlot, ShiftPatternDef, WorkerBlockInfo } from "@/types";

interface SimpleWorker {
  id: string;
  nombre: string;
}

interface Props {
  title: string;
  areaNegocio: "ventas" | "postventa";
  year: number;
  month: number;
  // Seed: si el guardado es de origen libre, los slots/assignments
  // guardados; si no, una grilla en blanco (un slot por trabajador).
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  slices: TeamSlice[];
  workers: SimpleWorker[];
  blocks: WorkerBlockInfo[];
  savedOrigen: "libre" | null;
  hasCalendar: boolean;
  scopeLabel: string;
  scopeType: "branch" | "group";
  prevMonthShifts?: PrevMonthShiftsMap;
  nextMonthShifts?: PrevMonthShiftsMap;
  isAdmin: boolean;
  backHref?: string;
  backLabel?: string;
}

// Patron sintetico: define la ventana horaria del editor (los dialogos de
// turno la usan como limites) y el rotulo del encabezado. Nunca se usa para
// GENERAR turnos — el "Limpiar todo" del modo libre devuelve la grilla en
// blanco sin pasar por generateCalendar.
function freePattern(areaNegocio: "ventas" | "postventa"): ShiftPatternDef {
  const fullDay = { start: SHIFT_WINDOW_START, end: SHIFT_WINDOW_END };
  return {
    id: "horario_libre",
    label: "Horario libre",
    areaNegocio,
    rotationWeeks: [[fullDay, fullDay, fullDay, fullDay, fullDay, fullDay, fullDay]],
    weeklyHours: [0],
    fixedSlots: true,
  };
}

function blankSlots(template: CalendarSlot[]): CalendarSlot[] {
  return template.map((slot) => ({
    ...slot,
    days: Object.fromEntries(Object.keys(slot.days).map((d) => [d, null])),
  }));
}

export default function FreeCalendarView({
  title, areaNegocio, year, month,
  slots, assignments, slices, workers, blocks,
  savedOrigen, hasCalendar, scopeLabel, scopeType,
  prevMonthShifts, nextMonthShifts, isAdmin, backHref, backLabel,
}: Props) {
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.nombre]));

  // Base de comparacion para el diff de cambios hacia RRHH: lo guardado
  // actual (cualquier origen). Se actualiza tras cada guardado exitoso
  // (leccion del bug de guardados duplicados, commit 35d09db).
  const lastSavedSlots = useRef<CalendarSlot[]>(slots);
  const lastSavedAssignments = useRef<Record<string, string | null>>(assignments);
  const savedOrigenRef = useRef<"libre" | null>(savedOrigen);

  async function saveLibre({
    slotsData, assignments: nextAssignments, validationSummary,
  }: {
    slotsData: CalendarSlot[];
    assignments: Record<string, string | null>;
    validationSummary?: { errorCount: number; warningCount: number; warningCodes: string[] };
  }) {
    const changes: ChangeItem[] | undefined = hasCalendar || savedOrigenRef.current === "libre"
      ? computeCalendarDiff(lastSavedSlots.current, slotsData, lastSavedAssignments.current, nextAssignments, workerMap, year, month)
      : undefined;

    for (const teamData of splitCalendarByTeam(slotsData, nextAssignments, slices)) {
      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: teamData.teamId,
          year, month,
          slotsData: teamData.slots,
          assignments: teamData.assignments,
          origen: "libre",
          validationSummary,
          scopeLabel, scopeType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al guardar el horario libre");
      }
    }

    void fetch("/api/calendars/save-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamIds: slices.map((s) => s.teamId),
        year, month, scopeLabel, scopeType,
        changes: changes ?? null,
      }),
    });

    lastSavedSlots.current = slotsData;
    lastSavedAssignments.current = nextAssignments;
    savedOrigenRef.current = "libre";
    return "libre-guardado";
  }

  return (
    <CalendarView
      key={`libre-${slices.map((s) => s.teamId).join("-")}-${year}-${month}`}
      branchId="horario-libre"
      branchName={title}
      branchCodigo={`${workers.length} trabajador${workers.length !== 1 ? "es" : ""}`}
      teamId={slices[0]?.teamId ?? "libre"}
      areaNegocio={areaNegocio}
      categoria="horario_libre"
      patternOverride={freePattern(areaNegocio)}
      year={year}
      month={month}
      slots={slots}
      assignments={assignments}
      workers={workers.map((w) => ({ id: w.id, nombre: w.nombre, rut: "", activo: true, esVirtual: false }))}
      workerMap={workerMap}
      workerBlocks={blocks}
      // calId presente siempre: activa el bloqueo de dias pasados para
      // supervisores y el flujo de edicion sobre calendario existente.
      calendarId="horario-libre"
      currentYear={year}
      currentMonth={month}
      backHref={backHref}
      backLabel={backLabel}
      showExportButtons
      hideExcelExport={!isAdmin}
      showValidationPanel
      enforceValidationBeforeSave
      calendarScopeLabel={scopeLabel}
      calendarScopeType={scopeType}
      prevMonthShifts={prevMonthShifts}
      nextMonthShifts={nextMonthShifts}
      isAdmin={isAdmin}
      saveConfirmMessage={hasCalendar && savedOrigen !== "libre"
        ? `Ya tienes un horario ROTATIVO guardado para este mes. Si guardas, este horario libre pasará a ser el horario oficial y lo reemplazará. ¿Continuar?`
        : undefined}
      onSaveCalendar={saveLibre}
      recalculateLabel="Limpiar todo"
      recalculateConfirmMessage="Esto dejará el horario libre completamente en blanco (los cambios no se guardan hasta presionar Guardar). ¿Continuar?"
      onRecalculateCalendar={async ({ currentSlots }) => ({
        slots: blankSlots(currentSlots),
        assignments,
      })}
      changeRemindMessage={savedOrigenRef.current === "libre"
        ? "Cuidado: estás haciendo cambios en un horario ya constituido. Los cambios serán informados a RRHH. Para que queden aplicados debes presionar Guardar al terminar. ¿Continuar?"
        : undefined}
    />
  );
}
