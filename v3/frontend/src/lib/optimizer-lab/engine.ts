import type {
  LabAssignment,
  LabDay,
  OptimizerDiagnostic,
  OptimizerLabInput,
  OptimizerLabResponse,
  OptimizerProposal,
  ProposalMetrics,
} from "./types";

const WEEKDAY_LABELS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

type ShiftId = "V_M7_APE" | "V_M7_CIE" | "V_M7_COM" | "OFF";

type ShiftDef = {
  id: ShiftId;
  label: string;
  laborHours: number;
};

type PhaseTemplate = Record<string, ShiftDef>;

const SHIFTS = {
  V_M7_APE: { id: "V_M7_APE", label: "APE", laborHours: 8 },
  V_M7_CIE: { id: "V_M7_CIE", label: "CIE", laborHours: 8 },
  V_M7_COM: { id: "V_M7_COM", label: "COM", laborHours: 9 },
  OFF: { id: "OFF", label: "Libre", laborHours: 0 },
} satisfies Record<ShiftId, ShiftDef>;

const PHASES: PhaseTemplate[] = [
  {
    lunes: SHIFTS.V_M7_APE,
    martes: SHIFTS.V_M7_COM,
    miercoles: SHIFTS.V_M7_CIE,
    jueves: SHIFTS.V_M7_COM,
    viernes: SHIFTS.V_M7_APE,
    sabado: SHIFTS.OFF,
    domingo: SHIFTS.OFF,
  },
  {
    lunes: SHIFTS.V_M7_CIE,
    martes: SHIFTS.OFF,
    miercoles: SHIFTS.V_M7_APE,
    jueves: SHIFTS.V_M7_COM,
    viernes: SHIFTS.V_M7_CIE,
    sabado: SHIFTS.OFF,
    domingo: SHIFTS.V_M7_COM,
  },
  {
    lunes: SHIFTS.V_M7_APE,
    martes: SHIFTS.V_M7_COM,
    miercoles: SHIFTS.OFF,
    jueves: SHIFTS.V_M7_CIE,
    viernes: SHIFTS.V_M7_COM,
    sabado: SHIFTS.V_M7_APE,
    domingo: SHIFTS.OFF,
  },
  {
    lunes: SHIFTS.OFF,
    martes: SHIFTS.V_M7_CIE,
    miercoles: SHIFTS.V_M7_APE,
    jueves: SHIFTS.V_M7_COM,
    viernes: SHIFTS.V_M7_CIE,
    sabado: SHIFTS.OFF,
    domingo: SHIFTS.V_M7_COM,
  },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthDates(year: number, month: number) {
  const firstVisible = new Date(year, month - 1, 1);
  const lastVisible = new Date(year, month, 0);

  const effectiveStart = new Date(firstVisible);
  effectiveStart.setDate(firstVisible.getDate() - ((firstVisible.getDay() + 6) % 7));

  const effectiveEnd = new Date(lastVisible);
  effectiveEnd.setDate(lastVisible.getDate() + ((7 - lastVisible.getDay()) % 7));

  const visibleDays: LabDay[] = [];
  const effectiveDays: LabDay[] = [];

  for (let cursor = new Date(effectiveStart); cursor <= effectiveEnd; cursor.setDate(cursor.getDate() + 1)) {
    const iso = toIsoDate(cursor);
    const weekday = WEEKDAY_LABELS[(cursor.getDay() + 6) % 7];
    const day: LabDay = {
      date: iso,
      weekday,
      inVisibleMonth: cursor.getMonth() === month - 1,
      isSunday: weekday === "domingo",
    };
    effectiveDays.push(day);
    if (day.inVisibleMonth) {
      visibleDays.push(day);
    }
  }

  return { visibleDays, effectiveDays };
}

function buildWeeks(days: LabDay[]) {
  const weeks: LabDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function minimumDotationForSundayMall(): number {
  const coverageMin = 2;
  const workDaysPerSlot = 5;
  return Math.ceil((7 * coverageMin) / workDaysPerSlot);
}

function buildAssignmentsForProposal(
  proposalIndex: number,
  dotation: number,
  weeks: LabDay[][]
): LabAssignment[] {
  const assignments: LabAssignment[] = [];

  for (let slot = 1; slot <= dotation; slot += 1) {
    const seed = (slot - 1 + proposalIndex) % PHASES.length;

    weeks.forEach((week, weekIndex) => {
      const phase = PHASES[(seed + weekIndex) % PHASES.length];

      week.forEach((day) => {
        const shift = phase[day.weekday];
        assignments.push({
          slotNumber: slot,
          date: day.date,
          shiftId: shift.id,
          label: shift.label,
          laborHours: shift.laborHours,
          isOff: shift.id === "OFF",
        });
      });
    });
  }

  return assignments;
}

function buildMetrics(assignments: LabAssignment[], visibleDays: LabDay[], dotation: number): ProposalMetrics {
  const visibleDateSet = new Set(visibleDays.map((day) => day.date));
  const shiftCounts: Record<string, number> = {
    V_M7_APE: 0,
    V_M7_CIE: 0,
    V_M7_COM: 0,
  };
  const coverageByDate: Record<string, number> = {};
  const slotHours: Record<string, number> = {};
  const freeSundaysBySlot = new Map<number, number>();

  for (let slot = 1; slot <= dotation; slot += 1) {
    slotHours[String(slot)] = 0;
    freeSundaysBySlot.set(slot, 0);
  }

  assignments
    .filter((assignment) => visibleDateSet.has(assignment.date))
    .forEach((assignment) => {
      if (!assignment.isOff) {
        shiftCounts[assignment.shiftId] = (shiftCounts[assignment.shiftId] ?? 0) + 1;
        coverageByDate[assignment.date] = (coverageByDate[assignment.date] ?? 0) + 1;
      } else {
        coverageByDate[assignment.date] = coverageByDate[assignment.date] ?? 0;
      }

      slotHours[String(assignment.slotNumber)] += assignment.laborHours;

      const day = visibleDays.find((item) => item.date === assignment.date);
      if (day?.isSunday && assignment.isOff) {
        freeSundaysBySlot.set(
          assignment.slotNumber,
          (freeSundaysBySlot.get(assignment.slotNumber) ?? 0) + 1
        );
      }
    });

  const freeSundays = Array.from(freeSundaysBySlot.values());
  const totalHours = Object.values(slotHours).reduce((sum, value) => sum + value, 0);

  return {
    averageHours: Number((totalHours / Math.max(dotation, 1)).toFixed(2)),
    minFreeSundays: freeSundays.length > 0 ? Math.min(...freeSundays) : 0,
    maxFreeSundays: freeSundays.length > 0 ? Math.max(...freeSundays) : 0,
    shiftCounts,
    coverageByDate,
    slotHours,
  };
}

function computeScore(metrics: ProposalMetrics): number {
  const apeVsCieGap = Math.abs((metrics.shiftCounts.V_M7_APE ?? 0) - (metrics.shiftCounts.V_M7_CIE ?? 0));
  const sundaySpreadGap = metrics.maxFreeSundays - metrics.minFreeSundays;
  const coverageValues = Object.values(metrics.coverageByDate);
  const averageCoverage =
    coverageValues.length > 0
      ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length
      : 0;
  const coveragePenalty = coverageValues.reduce(
    (sum, value) => sum + Math.abs(value - averageCoverage),
    0
  );

  return Number(Math.max(1, 100 - apeVsCieGap - sundaySpreadGap * 4 - coveragePenalty).toFixed(2));
}

function buildFeasibilityMessages(input: OptimizerLabInput, visibleDays: LabDay[], proposals: OptimizerProposal[]) {
  const messages: string[] = [];
  const visibleSundays = visibleDays.filter((day) => day.isSunday).length;

  if (input.weeklyHoursTarget !== 42) {
    messages.push("El playground inicial solo soporta 42 horas exactas por semana.");
  }

  if (input.maxConsecutiveDays < 4) {
    messages.push("La plantilla base del laboratorio necesita al menos 4 dias consecutivos permitidos.");
  }

  if (proposals.some((proposal) => proposal.metrics.minFreeSundays < input.minFreeSundays)) {
    messages.push("La dotacion o el ciclo actual no alcanzan el minimo de domingos libres solicitado.");
  }

  if (input.minFreeSundays > visibleSundays) {
    messages.push("El mes visible no tiene suficientes domingos para cumplir la meta solicitada.");
  }

  return messages;
}

export function runOptimizerLab(input: OptimizerLabInput): OptimizerLabResponse {
  const { visibleDays, effectiveDays } = getMonthDates(input.year, input.month);
  const weeks = buildWeeks(effectiveDays);
  const minimumSuggested = minimumDotationForSundayMall();
  const canUseBaseCycle =
    input.dotation >= minimumSuggested &&
    input.weeklyHoursTarget === 42 &&
    input.maxConsecutiveDays >= 4 &&
    input.minFreeSundays <= visibleDays.filter((day) => day.isSunday).length;

  let proposals: OptimizerProposal[] = [];
  if (canUseBaseCycle) {
    proposals = Array.from({ length: input.numProposals }, (_, index) => {
      const assignments = buildAssignmentsForProposal(index, input.dotation, weeks);
      const metrics = buildMetrics(assignments, visibleDays, input.dotation);
      return {
        id: `prop-${index + 1}`,
        score: computeScore(metrics),
        assignments: assignments.filter((assignment) =>
          visibleDays.some((day) => day.date === assignment.date)
        ),
        metrics,
      };
    }).filter((proposal) => proposal.metrics.minFreeSundays >= input.minFreeSundays);
  }

  const messages = buildFeasibilityMessages(input, visibleDays, proposals);
  if (input.dotation < minimumSuggested) {
    messages.unshift(
      `Dotacion insuficiente para una cobertura base de mall dominical. Se sugieren al menos ${minimumSuggested} slots.`
    );
  }
  if (proposals.length === 0 && messages.length === 0) {
    messages.push("No se encontro una propuesta factible con los parametros actuales.");
  }

  const diagnostic: OptimizerDiagnostic = {
    categoryLabel: "Ventas Mall Dominical",
    dotationAvailable: input.dotation,
    minimumSuggested,
    feasible: proposals.length > 0,
    messages,
    effectiveStart: effectiveDays[0]?.date ?? "",
    effectiveEnd: effectiveDays[effectiveDays.length - 1]?.date ?? "",
  };

  return {
    input,
    visibleDays,
    effectiveDays,
    diagnostic,
    proposals,
  };
}
