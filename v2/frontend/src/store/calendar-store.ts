import { create } from "zustand";
import type { Worker } from "@/types/models";
import type {
  CalendarAssignment,
  OptimizerProposal,
  ShiftDef,
  Violation,
} from "@/types/optimizer";

function makeId(a: { worker_rut: string; date: string; shift_id: string }): string {
  return `${a.worker_rut}_${a.date}_${a.shift_id}`;
}

function toCalendarAssignment(
  a: OptimizerProposal["asignaciones"][number]
): CalendarAssignment {
  return { ...a, id: makeId(a) };
}

export interface PartialReviewState {
  originalAssignments: CalendarAssignment[];
  pendingAssignments: CalendarAssignment[];
  range: { desde: string; hasta: string };
  workersExcluidos: string[];
}

export interface CalendarState {
  branchId: string;
  year: number;
  month: number;
  availableProposals: OptimizerProposal[];
  activeProposalId: string | null;
  assignments: CalendarAssignment[];
  workers: Worker[];
  shiftCatalog: ShiftDef[];
  holidays: string[];
  franjaPorDia: Record<string, { apertura: string; cierre: string } | null>;
  violations: Violation[];
  dirty: boolean;
  partialReview: PartialReviewState | null;
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
  selectProposal: (proposalId: string) => void;
  moveAssignment: (assignmentId: string, newDate: string) => void;
  assignWorker: (assignmentId: string, workerRut: string, workerSlot: number) => void;
  setSlotWorker: (slot: number, workerRut: string) => void;
  removeAssignment: (assignmentId: string) => void;
  addAssignment: (assignment: Omit<CalendarAssignment, "id">) => void;
  setViolations: (violations: Violation[]) => void;
  markSaved: () => void;
  enterPartialReview: (
    pendingAssignments: CalendarAssignment[],
    range: { desde: string; hasta: string },
    workersExcluidos: string[]
  ) => void;
  exitPartialReview: () => void;
  applyPartialReview: () => void;
  reset: () => void;
}

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
  partialReview: null,

  init({ branchId, year, month, proposals, workers, shiftCatalog, holidays, franjaPorDia }) {
    const sorted = [...proposals].sort((a, b) => b.score - a.score);
    const first = sorted[0] ?? null;
    set({
      branchId,
      year,
      month,
      availableProposals: sorted,
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

  setSlotWorker(slot, workerRut) {
    set((state) => ({
      assignments: state.assignments.map((a) => {
        if (a.worker_slot !== slot) return a;
        const updated = { ...a, worker_rut: workerRut };
        return { ...updated, id: makeId(updated) };
      }),
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

  enterPartialReview(pendingAssignments, range, workersExcluidos) {
    set((state) => ({
      partialReview: {
        originalAssignments: state.assignments,
        pendingAssignments,
        range,
        workersExcluidos,
      },
    }));
  },

  exitPartialReview() {
    set({ partialReview: null });
  },

  applyPartialReview() {
    const { partialReview } = get();
    if (!partialReview) return;
    const { desde, hasta } = partialReview.range;
    const outside = partialReview.originalAssignments.filter(
      (a) => a.date < desde || a.date > hasta
    );
    set({
      assignments: [...outside, ...partialReview.pendingAssignments],
      partialReview: null,
      violations: [],
      dirty: true,
    });
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
      partialReview: null,
    });
  },
}));
