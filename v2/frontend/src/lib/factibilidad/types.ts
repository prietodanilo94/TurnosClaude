export const FACTIBILITY_WEEKDAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

export type FactibilityWeekday = (typeof FACTIBILITY_WEEKDAYS)[number];
export type FactibilityRole = "APE" | "CIE";
export type FactibilityScheme = "fijo" | "rotativo";
export type FactibilitySeverity = "error" | "warning" | "info";
export type FactibilityView =
  | { mode: "cycle" }
  | { mode: "month"; year: number; month: number };

export interface FactibilityWorkerTemplate {
  id: string;
  label: string;
  group: string;
  weeklyRoles: FactibilityRole[];
  offDays: FactibilityWeekday[];
}

export interface FactibilityOption {
  id: string;
  title: string;
  scheme: FactibilityScheme;
  recommended: boolean;
  headline: string;
  shortAnalysis: string;
  summaryBullets: string[];
  workers: FactibilityWorkerTemplate[];
  roleCountsLabel: string;
}

export interface FactibilityStudyMetric {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface FactibilityStudySummary {
  status: string;
  statusTone: "bad" | "warn" | "good";
  recommendedLabel: string;
  recommendedOptionId?: FactibilityOption["id"];
  summary: string;
  simulationNote?: string;
  bullets: string[];
  metrics: FactibilityStudyMetric[];
}

export interface FactibilityScenario {
  headcount: number;
  title: string;
  verdict: string;
  verdictTone: "bad" | "warn" | "good";
  baselineAnalysis: string;
  fifthSundayNote: string;
  mixedOutlook?: string;
  study: FactibilityStudySummary;
  options: FactibilityOption[];
}

export interface FactibilityWorkerMetrics {
  workerId: string;
  label: string;
  group: string;
  workedSundays: number;
  sundayFreeCount: number;
  maxConsecutive: number;
}

export interface FactibilityCoverageCell {
  weekIndex: number;
  cycleWeekIndex: number;
  date: string;
  day: FactibilityWeekday;
  inMonth: boolean;
  apeOnDuty: number;
  cieOnDuty: number;
  totalOnDuty: number;
  meetsBaseCoverage: boolean;
}

export interface FactibilityViolation {
  severity: FactibilitySeverity;
  type: "coverage" | "consecutive" | "sundays";
  title: string;
  detail: string;
  workerId?: string;
  weekIndex?: number;
  day?: FactibilityWeekday;
}

export interface FactibilityAnalysis {
  feasible: boolean;
  maxConsecutiveOverall: number;
  maxWorkedSundays: number;
  maxAllowedWorkedSundays: number;
  totalSundaysInScope: number;
  minTotalOnDuty: number;
  visibleWeekCount: number;
  coverageCells: FactibilityCoverageCell[];
  workerMetrics: FactibilityWorkerMetrics[];
  violations: FactibilityViolation[];
}
