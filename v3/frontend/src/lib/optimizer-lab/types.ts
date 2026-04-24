export type OptimizerLabCategory = "ventas_mall_dominical";
export type OptimizerSolverMode = "heuristic" | "cp_sat";

export interface OptimizerLabInput {
  category: OptimizerLabCategory;
  solverMode: OptimizerSolverMode;
  year: number;
  month: number;
  dotation: number;
  weeklyHoursTarget: number;
  maxConsecutiveDays: number;
  minFreeSundays: number;
  numProposals: number;
  timeLimitSeconds: number;
}

export interface LabDay {
  date: string;
  weekday: string;
  inVisibleMonth: boolean;
  isSunday: boolean;
}

export interface LabAssignment {
  slotNumber: number;
  date: string;
  shiftId: "V_M7_APE" | "V_M7_CIE" | "V_M7_COM" | "OFF";
  label: string;
  laborHours: number;
  isOff: boolean;
  weekIndex: number;
}

export interface ProposalMetrics {
  averageHours: number;
  minFreeSundays: number;
  maxFreeSundays: number;
  minCoverage: number;
  coverageDeficitDays: string[];
  shiftCounts: Record<string, number>;
  coverageByDate: Record<string, number>;
  slotHours: Record<string, number>;
  weeklyHoursBySlot: Record<string, number[]>;
}

export interface OptimizerProposal {
  id: string;
  score: number;
  assignments: LabAssignment[];
  metrics: ProposalMetrics;
}

export interface OptimizerDiagnostic {
  categoryLabel: string;
  solverMode: OptimizerSolverMode;
  dotationAvailable: number;
  minimumSuggested: number | null;
  feasible: boolean;
  messages: string[];
  effectiveStart: string;
  effectiveEnd: string;
}

export interface OptimizerLabResponse {
  input: OptimizerLabInput;
  visibleDays: LabDay[];
  effectiveDays: LabDay[];
  diagnostic: OptimizerDiagnostic;
  proposals: OptimizerProposal[];
}
