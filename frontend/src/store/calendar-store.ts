import { create } from "zustand";
import type { Worker, ShiftCatalog } from "@/types/models";
import type {
  CalendarAssignment,
  OptimizerProposal,
  ShiftDef,
  Violation,
} from "@/types/optimizer";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeId(a: { worker_rut: string; date: string; shift_id: string }): string {
  return `${a.worker_rut}_${a.date}_${a.shift_id}`;
}

function toCalendarAssignment(
  a: OptimizerProposal["asignaciones"][number]
): CalendarAssignment {
  return { ...a, id: makeId(a) };
}

// ─── state shape ──────────────────────────────────────────────────────────────

export interface CalendarState {
  branchId: string;
  year: number;
  month: number;
  availableProposals: OptimizerProposal[];
  activeProposalId: string | null;
  assignments: CalendarAssignment[];
  workers: Worker[];
  shiftCatalog: ShiftDef[];
  holidays: string[];          // ["YYYY-MM-DD"]
  franjaPorDia: Record<string, { apertura: string; cierre: string } | null>;
  violations: Violation[];
  dirty: boolean;

  // ── actions ─────────────────────────────────────────────────────────────────

  /** Inicializa el store para una sucursal/mes determinado. */
  init: (params: {
    branchId: string;
    year: number;
    month: number;
    proposals: OptimizerProposal[];
    workers: Worker[];
    shiftCatalog: ShiftDef[];
    holidays: string[];
    franjaPorDia: Record<string, { apertura: string; cierre: string } | null>;
  }) => void;

  /** Cambia la propuesta activa y carga sus asignaciones. */
  selectProposal: (proposalId: string) => void;

  /** Mueve un turno a otra fecha (drag & drop). */
  moveAssignment: (assignmentId: string, newDate: string) => void;

  /** Asigna un trabajador real a un slot (cambia worker_rut). */
  assignWorker: (assignmentId: string, workerRut: string, workerSlot: number) => void;

  /** Elimina una asignación. */
  removeAssignment: (assignmentId: string) => void;

  /** Añade una asignación manual. */
  addAssignment: (assignment: Omit<CalendarAssignment, "id">) => void;

  /** Actualiza las violaciones tras una llamada a /validate. */
  setViolations: (violations: Violation[]) => void;

  /** Marca el estado como guardado (sin cambios pendientes). */
  markSaved: () => void;

  /** Resetea el store al estado inicial. */
  reset: () => void;
}

// ─── store ────────────────────────────────────────────────────────────────────


export const useCalendarStore = create<CalendarState>((set, get) => ({
  branchId: "",
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  availableProposals: [],
  activeProposalId: null,
  assignments: [],
  workers: [],
  shiftCatalog: [],
  holidays: [],
  franjaPorDia: {},
  violations: [],
  dirty: false,

  init({ branchId, year, month, proposals, workers, shiftCatalog, holidays, franjaPorDia }) {
    const first = proposals[0] ?? null;
    set({
      branchId,
      year,
      month,
      availableProposals: proposals,
      activeProposalId: first?.id ?? null,
      assignments: first ? first.asignaciones.map(toCalendarAssignment) : [],
      workers,
      shiftCatalog,
      holidays,
      franjaPorDia,
      violations: [],
      dirty: false,
    });
  },

  selectProposal(proposalId) {
    const proposal = get().availableProposals.find((p) => p.id === proposalId);
    if (!proposal) return;
    set({
      activeProposalId: proposalId,
      assignments: proposal.asignaciones.map(toCalendarAssignment),
      violations: [],
      dirty: false,
    });
  },

  moveAssignment(assignmentId, newDate) {
    set((state) => ({
      assignments: state.assignments.map((a) => {
        if (a.id !== assignmentId) return a;
        const updated = { ...a, date: newDate };
        return { ...updated, id: makeId(updated) };
      }),
      violations: [],
      dirty: true,
    }));
  },

  assignWorker(assignmentId, workerRut, workerSlot) {
    set((state) => ({
      assignments: state.assignments.map((a) => {
        if (a.id !== assignmentId) return a;
        const updated = { ...a, worker_rut: workerRut, worker_slot: workerSlot };
        return { ...updated, id: makeId(updated) };
      }),
      violations: [],
      dirty: true,
    }));
  },

  removeAssignment(assignmentId) {
    set((state) => ({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
      violations: [],
      dirty: true,
    }));
  },

  addAssignment(assignment) {
    const full: CalendarAssignment = { ...assignment, id: makeId(assignment) };
    set((state) => ({
      assignments: [...state.assignments, full],
      violations: [],
      dirty: true,
    }));
  },

  setViolations(violations) {
    set({ violations });
  },

  markSaved() {
    set({ dirty: false });
  },

  reset() {
    set({
      branchId: "",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      availableProposals: [],
      activeProposalId: null,
      assignments: [],
      workers: [],
      shiftCatalog: [],
      holidays: [],
      franjaPorDia: {},
      violations: [],
      dirty: false,
    });
  },
}));
