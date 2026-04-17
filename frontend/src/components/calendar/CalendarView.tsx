"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCalendarStore } from "@/store/calendar-store";
import { validateLocal } from "@/lib/calendar/local-validator";
import { MonthGrid } from "./MonthGrid";
import { ProposalSelector } from "./ProposalSelector";
import { SaveButton } from "./SaveButton";
import { WorkerAssignDialog } from "./WorkerAssignDialog";
import type { CalendarAssignment } from "@/types/optimizer";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function CalendarView() {
  const {
    year, month, assignments, workers, shiftCatalog,
    holidays, franjaPorDia, violations,
    moveAssignment, assignWorker, removeAssignment, setViolations,
  } = useCalendarStore();

  const [draggingAssignment, setDraggingAssignment] = useState<CalendarAssignment | null>(null);
  const [dialogAssignment, setDialogAssignment] = useState<CalendarAssignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { assignment: CalendarAssignment } | undefined;
    setDraggingAssignment(data?.assignment ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingAssignment(null);
    const { active, over } = event;
    if (!over) return;

    const oldId = active.id as string;
    const newDate = over.id as string;
    const original = assignments.find((a) => a.id === oldId);
    if (!original || original.date === newDate) return;

    // Proyectar estado post-movimiento para validar antes de persistir
    const makeId = (a: CalendarAssignment) => `${a.worker_rut}_${a.date}_${a.shift_id}`;
    const newAssignments = assignments.map((a) => {
      if (a.id !== oldId) return a;
      const updated = { ...a, date: newDate };
      return { ...updated, id: makeId(updated) };
    });

    moveAssignment(oldId, newDate);
    runValidation(newAssignments);
  }

  function runValidation(currentAssignments: CalendarAssignment[]) {
    const newViolations = validateLocal({
      assignments: currentAssignments,
      workers,
      constraints: [],
      shiftCatalog,
      holidays,
      horasSemanalesMax: 42,
      diasMaximosConsecutivos: 6,
      domingoLibresMinimos: 2,
      coberturaminima: 2,
      franjaPorDia,
    });
    setViolations(newViolations);
  }

  function handleSlotClick(a: CalendarAssignment) {
    setDialogAssignment(a);
  }

  function handleAssignWorker(workerRut: string, workerSlot: number) {
    if (!dialogAssignment) return;
    const makeId = (a: CalendarAssignment) => `${a.worker_rut}_${a.date}_${a.shift_id}`;
    const newAssignments = assignments.map((a) => {
      if (a.id !== dialogAssignment.id) return a;
      const updated = { ...a, worker_rut: workerRut, worker_slot: workerSlot };
      return { ...updated, id: makeId(updated) };
    });
    assignWorker(dialogAssignment.id, workerRut, workerSlot);
    runValidation(newAssignments);
  }

  function handleRemoveAssignment() {
    if (!dialogAssignment) return;
    const newAssignments = assignments.filter((a) => a.id !== dialogAssignment.id);
    removeAssignment(dialogAssignment.id);
    runValidation(newAssignments);
  }

  // Info del slot arrastrado para el overlay
  const dragWorker = draggingAssignment
    ? workers.find((w) => w.rut === draggingAssignment.worker_rut)
    : null;
  const dragShift = draggingAssignment
    ? shiftCatalog.find((s) => s.id === draggingAssignment.shift_id)
    : null;
  const dragLabel = dragWorker
    ? dragWorker.nombre_completo.split(" ").slice(0, 2).join(" ")
    : draggingAssignment
    ? `Trabajador ${draggingAssignment.worker_slot}`
    : "";

  return (
    <div className="p-4 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {MONTH_NAMES[month]} {year}
          </h1>
          <ProposalSelector />
        </div>

        <div className="flex items-center gap-3">
          {violations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              <span className="text-red-600 font-medium text-sm">
                {violations.length} violación{violations.length !== 1 ? "es" : ""}
              </span>
            </div>
          )}
          <SaveButton />
        </div>
      </div>

      {/* Grid del mes con DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <MonthGrid
          year={year}
          month={month}
          franjaPorDia={franjaPorDia}
          holidays={holidays}
          assignments={assignments}
          workers={workers}
          shifts={shiftCatalog}
          violations={violations}
          maxHours={42}
          onSlotClick={handleSlotClick}
        />

        <DragOverlay dropAnimation={null}>
          {draggingAssignment && (
            <div className="rounded-md border px-2 py-1 text-xs leading-tight bg-white border-gray-400 shadow-xl opacity-95 w-32 pointer-events-none">
              <div className="font-medium truncate">{dragLabel}</div>
              {dragShift && (
                <div className="opacity-75">{dragShift.inicio}–{dragShift.fin}</div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialog de asignación — Task 11 */}
      {dialogAssignment && (
        <WorkerAssignDialog
          assignment={dialogAssignment}
          shift={shiftCatalog.find((s) => s.id === dialogAssignment.shift_id)}
          workers={workers}
          onAssign={handleAssignWorker}
          onRemove={handleRemoveAssignment}
          onClose={() => setDialogAssignment(null)}
        />
      )}
    </div>
  );
}
