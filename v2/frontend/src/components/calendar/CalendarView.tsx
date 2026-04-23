"use client";

import { useState, useMemo, type MouseEvent } from "react";
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
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { validateLocal } from "@/lib/calendar/local-validator";
import { ExportButton } from "./ExportButton";
import { ExportCalendarButton } from "./ExportCalendarButton";
import { MonthGrid } from "./MonthGrid";
import { OverrideMenu, type OverrideTarget } from "./OverrideMenu";
import { ProposalSelector } from "./ProposalSelector";
import { SaveButton } from "./SaveButton";
import { WorkerAssignDialog } from "./WorkerAssignDialog";
import { PartialRecalculateDialog, type PartialRecalculateParams } from "@/features/calendar/PartialRecalculateDialog";
import { WorkerMappingPanel } from "./WorkerMappingPanel";
import { callPartialOptimize, PartialOptimizeError, extendToFullIsoWeeks } from "@/lib/optimizer/build-partial-payload";
import type { CalendarAssignment } from "@/types/optimizer";
import type { OverrideType, SlotOverride } from "@/types/models";
import { ID, Query } from "appwrite";
import { account, databases } from "@/lib/auth/appwrite-client";
import { getShiftWindow } from "@/lib/calendar/shift-utils";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function CalendarView() {
  const {
    branchId, year, month, assignments, workers, shiftCatalog,
    currentOverrides,
    holidays, franjaPorDia, violations, partialReview,
    activeProposalId,
    moveAssignment, removeAssignment, setViolations,
    enterPartialReview, exitPartialReview, applyPartialReview, markSaved, setSlotWorker,
    replaceAssignments, setCurrentOverrides,
  } = useCalendarStore();
  const { user } = useCurrentUser();

  // slotToWorker: mapeado desde assignments REALES (con RUTs reales), no displayAssignments.
  // En modo revisión, los pendingAssignments tienen RUTs anónimos (worker_N) del solver.
  const slotToWorker = useMemo(() => {
    const byRut = Object.fromEntries(workers.map((w) => [w.rut, w]));
    const map: Record<number, typeof workers[0]> = {};
    const source = partialReview?.originalAssignments ?? assignments;
    for (const a of source) {
      if (!map[a.worker_slot] && byRut[a.worker_rut]) {
        map[a.worker_slot] = byRut[a.worker_rut];
      }
    }
    return map;
  }, [assignments, workers, partialReview]);

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
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function sameISOWeek(a: string, b: string): boolean {
    const getMonday = (d: Date) => {
      const day = d.getDay() || 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day + 1);
      return mon.toISOString().slice(0, 10);
    };
    return getMonday(new Date(a + "T12:00:00")) === getMonday(new Date(b + "T12:00:00"));
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { assignment: CalendarAssignment } | undefined;
    setDraggingAssignment(data?.assignment ?? null);
    setDragError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingAssignment(null);
    const { active, over } = event;
    if (!over) return;

    const oldId = active.id as string;
    const newDate = over.id as string;
    const original = assignments.find((a) => a.id === oldId);
    if (!original || original.date === newDate) return;

    if (!sameISOWeek(original.date, newDate)) {
      setDragError("Solo se puede mover un turno dentro de la misma semana.");
      return;
    }

    const workerBusy = assignments.some(
      (a) => a.id !== oldId && a.worker_rut === original.worker_rut && a.date === newDate
    );
    if (workerBusy) {
      setDragError("El trabajador ya tiene turno ese día.");
      return;
    }

    setDragError(null);
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

  function serializeAssignments(currentAssignments: CalendarAssignment[]) {
    return JSON.stringify(
      currentAssignments.map((assignment) => ({
        slot: assignment.worker_slot,
        date: assignment.date,
        shift_id: assignment.shift_id,
        worker_rut: assignment.worker_rut,
      }))
    );
  }

  async function persistProposalAssignments(currentAssignments: CalendarAssignment[]) {
    if (!activeProposalId) {
      throw new Error("No hay propuesta activa para aplicar overrides.");
    }

    await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2",
      "proposals",
      activeProposalId,
      {
        asignaciones: serializeAssignments(currentAssignments),
      }
    );
  }

  async function writeOverrideAuditLog(
    action: string,
    metadata: Record<string, unknown>
  ) {
    if (!user || !activeProposalId) return;

    await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2",
      "audit_log",
      ID.unique(),
      {
        user_id: user.$id,
        accion: action,
        entidad: "proposals",
        entidad_id: activeProposalId,
        metadata: JSON.stringify(metadata),
      }
    );
  }

  function handleSlotClick(a: CalendarAssignment) {
    setDialogAssignment(a);
  }

  function handleAssignWorker(workerRut: string, _workerSlot: number) {
    if (!dialogAssignment) return;
    const targetSlot = dialogAssignment.worker_slot;
    setSlotWorker(targetSlot, workerRut);
    const makeId = (a: CalendarAssignment) => `${a.worker_rut}_${a.date}_${a.shift_id}`;
    const newAssignments = assignments.map((a) => {
      if (a.worker_slot !== targetSlot) return a;
      const updated = { ...a, worker_rut: workerRut };
      return { ...updated, id: makeId(updated) };
    });
    runValidation(newAssignments);
  }

  function openAssignmentOverrideMenu(
    event: MouseEvent<HTMLDivElement>,
    payload: { assignment: CalendarAssignment; override?: SlotOverride }
  ) {
    event.preventDefault();
    if (partialReview) return;

    const worker = workers.find((item) => item.rut === payload.assignment.worker_rut);
    setOverrideTarget({
      date: payload.assignment.date,
      slot: payload.assignment.worker_slot,
      workerLabel: worker
        ? worker.nombre_completo.split(" ").slice(0, 2).join(" ")
        : `Trabajador ${payload.assignment.worker_slot}`,
      assignment: payload.assignment,
      existingOverride: payload.override,
      isSunday: payload.assignment.date ? new Date(`${payload.assignment.date}T12:00:00`).getDay() === 0 : false,
    });
  }

  function openFreeSlotOverrideMenu(
    event: MouseEvent<HTMLDivElement>,
    payload: { date: string; slot: number; override?: SlotOverride; isSunday: boolean }
  ) {
    event.preventDefault();
    if (partialReview) return;

    const worker = slotToWorker[payload.slot];
    setOverrideTarget({
      date: payload.date,
      slot: payload.slot,
      workerLabel: worker
        ? worker.nombre_completo.split(" ").slice(0, 2).join(" ")
        : `Trabajador ${payload.slot}`,
      existingOverride: payload.override,
      isSunday: payload.isSunday,
    });
  }

  async function handleApplyOverride(params: {
    tipo: OverrideType;
    shiftIdNuevo?: string;
    notas?: string;
  }) {
    if (!overrideTarget || !activeProposalId || !user) {
      throw new Error("No hay contexto suficiente para aplicar el override.");
    }

    const previousAssignments = assignments;
    const previousOverrides = currentOverrides;
    let nextAssignments = assignments;

    if (params.tipo === "cambiar_turno") {
      if (!overrideTarget.assignment || !params.shiftIdNuevo) {
        throw new Error("Falta el turno nuevo para cambiar el slot.");
      }
      nextAssignments = assignments.map((assignment) =>
        assignment.id === overrideTarget.assignment?.id
          ? {
              ...assignment,
              shift_id: params.shiftIdNuevo!,
              id: `${assignment.worker_rut}_${assignment.date}_${params.shiftIdNuevo!}`,
            }
          : assignment
      );
    }

    if (params.tipo === "marcar_libre") {
      if (!overrideTarget.assignment) {
        throw new Error("No hay slot trabajado para marcar libre.");
      }
      nextAssignments = assignments.filter(
        (assignment) => assignment.id !== overrideTarget.assignment?.id
      );
    }

    if (params.tipo === "marcar_trabajado") {
      if (!params.shiftIdNuevo) {
        throw new Error("Selecciona el turno que quieres agregar.");
      }

      const worker = slotToWorker[overrideTarget.slot];
      if (!worker) {
        throw new Error("Este slot no tiene un trabajador vinculado.");
      }

      const alreadyWorkingThatDay = assignments.some(
        (assignment) =>
          assignment.worker_rut === worker.rut && assignment.date === overrideTarget.date
      );
      if (alreadyWorkingThatDay) {
        throw new Error("El trabajador ya tiene un turno ese dia.");
      }

      nextAssignments = [
        ...assignments,
        {
          id: `${worker.rut}_${overrideTarget.date}_${params.shiftIdNuevo}`,
          worker_slot: overrideTarget.slot,
          worker_rut: worker.rut,
          date: overrideTarget.date,
          shift_id: params.shiftIdNuevo,
        },
      ];
    }

    if (params.tipo === "proteger_domingo" && !overrideTarget.isSunday) {
      throw new Error("Solo se puede proteger un domingo libre.");
    }

    const optimisticOverride: SlotOverride = {
      $id: `temp-${Date.now()}`,
      proposal_id: activeProposalId,
      fecha: overrideTarget.date,
      slot_numero: overrideTarget.slot,
      tipo: params.tipo,
      shift_id_original: overrideTarget.assignment?.shift_id,
      shift_id_nuevo: params.shiftIdNuevo,
      notas: params.notas,
      creado_por: user.$id,
    };

    replaceAssignments(nextAssignments, false);
    setCurrentOverrides([...previousOverrides, optimisticOverride]);
    runValidation(nextAssignments);

    try {
      const overrideDoc = (await databases.createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2",
        "slot_overrides",
        ID.unique(),
        {
          proposal_id: activeProposalId,
          fecha: overrideTarget.date,
          slot_numero: overrideTarget.slot,
          tipo: params.tipo,
          shift_id_original: overrideTarget.assignment?.shift_id,
          shift_id_nuevo: params.shiftIdNuevo,
          notas: params.notas,
          creado_por: user.$id,
        }
      )) as unknown as SlotOverride;

      await persistProposalAssignments(nextAssignments);
      await writeOverrideAuditLog("slot_override.create", {
        tipo: params.tipo,
        fecha: overrideTarget.date,
        slot_numero: overrideTarget.slot,
        shift_id_original: overrideTarget.assignment?.shift_id ?? null,
        shift_id_nuevo: params.shiftIdNuevo ?? null,
      });

      setCurrentOverrides([...previousOverrides, overrideDoc]);
      markSaved();
    } catch (error) {
      replaceAssignments(previousAssignments, false);
      setCurrentOverrides(previousOverrides);
      runValidation(previousAssignments);
      throw error;
    }
  }

  async function handleRevertOverride(override: SlotOverride) {
    if (!activeProposalId || !user) {
      throw new Error("No hay contexto suficiente para revertir el override.");
    }

    const previousAssignments = assignments;
    const previousOverrides = currentOverrides;
    let nextAssignments = assignments;

    if (override.tipo === "cambiar_turno") {
      if (!override.shift_id_original) {
        throw new Error("El override no tiene turno original para revertir.");
      }
      nextAssignments = assignments.map((assignment) =>
        assignment.date === override.fecha && assignment.worker_slot === override.slot_numero
          ? {
              ...assignment,
              shift_id: override.shift_id_original!,
              id: `${assignment.worker_rut}_${assignment.date}_${override.shift_id_original!}`,
            }
          : assignment
      );
    }

    if (override.tipo === "marcar_libre") {
      if (!override.shift_id_original || override.slot_numero === undefined) {
        throw new Error("Faltan datos para restaurar el turno original.");
      }
      const worker = slotToWorker[override.slot_numero];
      if (!worker) {
        throw new Error("No se pudo resolver el trabajador del slot original.");
      }
      nextAssignments = [
        ...assignments,
        {
          id: `${worker.rut}_${override.fecha}_${override.shift_id_original}`,
          worker_slot: override.slot_numero,
          worker_rut: worker.rut,
          date: override.fecha,
          shift_id: override.shift_id_original,
        },
      ];
    }

    if (override.tipo === "marcar_trabajado") {
      nextAssignments = assignments.filter(
        (assignment) =>
          !(
            assignment.date === override.fecha &&
            assignment.worker_slot === override.slot_numero &&
            assignment.shift_id === override.shift_id_nuevo
          )
      );
    }

    replaceAssignments(nextAssignments, false);
    setCurrentOverrides(previousOverrides.filter((item) => item.$id !== override.$id));
    runValidation(nextAssignments);

    try {
      await databases.deleteDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2",
        "slot_overrides",
        override.$id
      );
      await persistProposalAssignments(nextAssignments);
      await writeOverrideAuditLog("slot_override.revert", {
        tipo: override.tipo,
        fecha: override.fecha,
        slot_numero: override.slot_numero ?? null,
      });
      markSaved();
    } catch (error) {
      replaceAssignments(previousAssignments, false);
      setCurrentOverrides(previousOverrides);
      runValidation(previousAssignments);
      throw error;
    }
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
      const existingDates = new Set(assignments.map((a) => a.date));
      const { desde: extDesde, hasta: extHasta } = extendToFullIsoWeeks(
        params.desde, params.hasta, existingDates
      );
      enterPartialReview(pending, { desde: extDesde, hasta: extHasta }, params.excludedRuts);
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
      const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";
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
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2",
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

  function handleApplyMapping(mapping: Record<number, string>) {
    for (const [slotStr, workerRut] of Object.entries(mapping)) {
      if (workerRut) setSlotWorker(Number(slotStr), workerRut);
    }
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
  const dragWindow = draggingAssignment ? getShiftWindow(dragShift, draggingAssignment.date) : null;
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
          {dragError && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
              <span className="text-amber-700 font-medium text-sm">{dragError}</span>
            </div>
          )}
          {violations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              <span className="text-red-600 font-medium text-sm">
                {violations.length} violación{violations.length !== 1 ? "es" : ""}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowMappingPanel(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Asignar trabajadores
          </button>
          <button
            onClick={() => { setPartialError(null); setShowPartialDialog(true); }}
            disabled={partialLoading}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {partialLoading ? "Calculando…" : "Recalcular parcial"}
          </button>
          <SaveButton />
          <ExportCalendarButton />
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
          currentOverrides={partialReview ? [] : currentOverrides}
          slotToWorker={slotToWorker}
          violations={partialReview ? [] : violations}
          maxHours={42}
          partialRange={partialReview?.range}
          onSlotClick={partialReview ? undefined : handleSlotClick}
          onAssignmentContextMenu={partialReview ? undefined : openAssignmentOverrideMenu}
          onFreeSlotContextMenu={partialReview ? undefined : openFreeSlotOverrideMenu}
        />

        <DragOverlay dropAnimation={null}>
          {draggingAssignment && (
            <div className="rounded-md border px-2 py-1 text-xs leading-tight bg-white border-gray-400 shadow-xl opacity-95 w-32 pointer-events-none">
              <div className="font-medium truncate">{dragLabel}</div>
              {dragWindow && (
                <div className="opacity-75">{dragWindow.inicio}-{dragWindow.fin}</div>
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

      {showMappingPanel && (
        <WorkerMappingPanel
          assignments={displayAssignments}
          workers={workers}
          onApply={handleApplyMapping}
          onClose={() => setShowMappingPanel(false)}
        />
      )}

      {overrideTarget && (
        <OverrideMenu
          target={overrideTarget}
          shifts={shiftCatalog}
          onApply={handleApplyOverride}
          onRevert={handleRevertOverride}
          onClose={() => setOverrideTarget(null)}
        />
      )}
    </div>
  );
}
