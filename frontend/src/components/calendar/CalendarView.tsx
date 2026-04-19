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
import { ExportButton } from "./ExportButton";
import { MonthGrid } from "./MonthGrid";
import { ProposalSelector } from "./ProposalSelector";
import { SaveButton } from "./SaveButton";
import { WorkerAssignDialog } from "./WorkerAssignDialog";
import { PartialRecalculateDialog, type PartialRecalculateParams } from "@/features/calendar/PartialRecalculateDialog";
import { callPartialOptimize, PartialOptimizeError } from "@/lib/optimizer/build-partial-payload";
import type { CalendarAssignment } from "@/types/optimizer";
import { ID, Query } from "appwrite";
import { account, databases } from "@/lib/auth/appwrite-client";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function CalendarView() {
  const {
    branchId, year, month, assignments, workers, shiftCatalog,
    holidays, franjaPorDia, violations, partialReview,
    activeProposalId,
    moveAssignment, assignWorker, removeAssignment, setViolations,
    enterPartialReview, exitPartialReview, applyPartialReview, markSaved,
  } = useCalendarStore();

  // En modo revisión: mostrar asignaciones originales fuera del rango + pendientes dentro
  const displayAssignments = partialReview
    ? [
        ...partialReview.originalAssignments.filter(
          (a) => a.date < partialReview.range.desde || a.date > partialReview.range.hasta
        ),
        ...partialReview.pendingAssignments,
      ]
    : assignments;

  const [draggingAssignment, setDraggingAssignment] = useState<CalendarAssignment | null>(null);
  const [dialogAssignment, setDialogAssignment] = useState<CalendarAssignment | null>(null);
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const [partialLoading, setPartialLoading] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);

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

  async function handlePartialConfirm(params: PartialRecalculateParams) {
    setPartialLoading(true);
    setPartialError(null);
    setShowPartialDialog(false);
    try {
      const response = await callPartialOptimize(branchId, year, month, assignments, params);
      const proposal = response.propuestas[0];
      if (!proposal) throw new Error("El solver no devolvió ninguna propuesta.");
      const pending = proposal.asignaciones.map((a) => ({
        ...a,
        id: `${a.worker_rut}_${a.date}_${a.shift_id}`,
      }));
      enterPartialReview(pending, { desde: params.desde, hasta: params.hasta }, params.excludedRuts);
    } catch (e) {
      const msg = e instanceof PartialOptimizeError ? e.message : "Error al recalcular parcial.";
      setPartialError(msg);
    } finally {
      setPartialLoading(false);
    }
  }

  async function handleApprove() {
    if (!partialReview) return;
    const { range, workersExcluidos, originalAssignments, pendingAssignments } = partialReview;

    const origInRange = new Set(
      originalAssignments
        .filter((a) => a.date >= range.desde && a.date <= range.hasta)
        .map((a) => a.id)
    );
    const pendingIds = new Set(pendingAssignments.map((a) => a.id));
    const n_changes =
      Array.from(origInRange).filter((id) => !pendingIds.has(id)).length +
      Array.from(pendingIds).filter((id) => !origInRange.has(id)).length;

    // Merge final de asignaciones (igual que applyPartialReview, pero lo necesitamos antes)
    const outside = originalAssignments.filter(
      (a) => a.date < range.desde || a.date > range.hasta
    );
    const merged = [...outside, ...pendingAssignments];

    // Actualizar store
    applyPartialReview();

    // Persistir en Appwrite
    if (activeProposalId) {
      const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";
      const rutToId = new Map(workers.map((w) => [w.rut, w.$id]));

      try {
        await databases.updateDocument(DB, "proposals", activeProposalId, {
          asignaciones: JSON.stringify(
            merged.map((a) => ({
              slot: a.worker_slot,
              date: a.date,
              shift_id: a.shift_id,
              worker_rut: a.worker_rut,
            }))
          ),
        });

        // Upsert un assignment doc por slot único
        const slotMap = new Map<number, string>();
        for (const a of merged) {
          if (!slotMap.has(a.worker_slot)) slotMap.set(a.worker_slot, a.worker_rut);
        }

        const existing = await databases.listDocuments(DB, "assignments", [
          Query.equal("proposal_id", activeProposalId),
          Query.limit(200),
        ]);
        const slotToDocId = new Map(
          existing.documents.map((d) => [d.slot_numero as number, d.$id])
        );

        await Promise.all(
          Array.from(slotMap.entries()).map(([slot, rut]) => {
            const workerId = rutToId.get(rut) ?? rut;
            const docId = slotToDocId.get(slot);
            if (docId) {
              return databases.updateDocument(DB, "assignments", docId, {
                worker_id: workerId,
                asignado_en: new Date().toISOString(),
              });
            }
            return databases.createDocument(DB, "assignments", ID.unique(), {
              proposal_id: activeProposalId,
              slot_numero: slot,
              worker_id: workerId,
              asignado_en: new Date().toISOString(),
            });
          })
        );

        markSaved();
      } catch (e) {
        console.error("Error al persistir recálculo parcial:", e);
        // No revertimos el store: dirty=true queda activo para que el usuario pueda reintentar con Guardar
      }
    }

    // Audit log — best-effort
    try {
      const authUser = await account.get();
      await databases.createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main",
        "audit_log",
        ID.unique(),
        {
          user_id: authUser.$id,
          accion: "partial_recalculate.aprobar",
          entidad: "proposals",
          entidad_id: activeProposalId ?? "",
          metadata: JSON.stringify({ rango: range, workers_excluidos: workersExcluidos, n_changes }),
        }
      );
    } catch { /* best-effort */ }
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
      {/* Banner de revisión parcial */}
      {partialReview && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border border-emerald-300 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Revisando recálculo parcial
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Rango modificado: {partialReview.range.desde} → {partialReview.range.hasta}.
              Los días en verde son los recalculados; el resto está atenuado.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={exitPartialReview}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 bg-white rounded-md hover:bg-gray-50 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleApprove}
              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
            >
              Aprobar
            </button>
          </div>
        </div>
      )}

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
          <button
            onClick={() => { setPartialError(null); setShowPartialDialog(true); }}
            disabled={partialLoading}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {partialLoading ? "Calculando…" : "Recalcular parcial"}
          </button>
          <SaveButton />
          <ExportButton />
        </div>
      </div>

      {/* Grid del mes con DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <MonthGrid
          year={year}
          month={month}
          franjaPorDia={franjaPorDia}
          holidays={holidays}
          assignments={displayAssignments}
          workers={workers}
          shifts={shiftCatalog}
          violations={partialReview ? [] : violations}
          maxHours={42}
          partialRange={partialReview?.range}
          onSlotClick={partialReview ? undefined : handleSlotClick}
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

      {partialError && (
        <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {partialError}
        </div>
      )}

      {showPartialDialog && (
        <PartialRecalculateDialog
          onConfirm={handlePartialConfirm}
          onClose={() => setShowPartialDialog(false)}
        />
      )}

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
