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
const COVERAGE_MIN = 2;

type ShiftId = "V_M7_APE" | "V_M7_CIE" | "V_M7_COM" | "OFF";

type ShiftDef = {
  id: ShiftId;
  label: string;
  laborHours: number;
};

type WeekPattern = {
  key: string;
  shifts: ShiftDef[];
  worksSunday: boolean;
  shiftCounts: {
    ape: number;
    cie: number;
    com: number;
  };
};

type ProposalAttempt =
  | {
      feasible: true;
      proposal: OptimizerProposal;
      hash: string;
    }
  | {
      feasible: false;
      reason: string;
    };

const SHIFTS = {
  V_M7_APE: { id: "V_M7_APE", label: "APE", laborHours: 8 },
  V_M7_CIE: { id: "V_M7_CIE", label: "CIE", laborHours: 8 },
  V_M7_COM: { id: "V_M7_COM", label: "COM", laborHours: 9 },
  OFF: { id: "OFF", label: "Libre", laborHours: 0 },
} satisfies Record<ShiftId, ShiftDef>;

const patternCache = new Map<number, WeekPattern[]>();

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function combinations(values: number[], choose: number): number[][] {
  if (choose === 0) return [[]];
  if (values.length < choose) return [];
  if (values.length === choose) return [values];

  const [head, ...tail] = values;
  const withHead = combinations(tail, choose - 1).map((combo) => [head, ...combo]);
  const withoutHead = combinations(tail, choose);
  return [...withHead, ...withoutHead];
}

function rotate<T>(values: T[], offset: number) {
  if (values.length === 0) return values;
  const normalized = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function seededNoise(...values: number[]) {
  let hash = 2166136261;
  values.forEach((value, index) => {
    hash ^= value + index * 374761393;
    hash = Math.imul(hash, 16777619);
  });
  return ((hash >>> 0) % 1000) / 1000;
}

function longestConsecutiveWorkDays(shifts: ShiftDef[]) {
  let current = 0;
  let max = 0;

  shifts.forEach((shift) => {
    if (shift.id === "OFF") {
      current = 0;
      return;
    }

    current += 1;
    max = Math.max(max, current);
  });

  return max;
}

function buildCandidatePatterns(maxConsecutiveDays: number) {
  const cached = patternCache.get(maxConsecutiveDays);
  if (cached) return cached;

  const patterns: WeekPattern[] = [];
  const allDayIndexes = [0, 1, 2, 3, 4, 5, 6];

  combinations(allDayIndexes, 2).forEach((offDays) => {
    const offSet = new Set(offDays);
    const workDays = allDayIndexes.filter((dayIndex) => !offSet.has(dayIndex));

    combinations(workDays, 2).forEach((comDays) => {
      const comSet = new Set(comDays);
      const shortDays = workDays.filter((dayIndex) => !comSet.has(dayIndex));

      for (let mask = 0; mask < 2 ** shortDays.length; mask += 1) {
        const shifts = allDayIndexes.map((dayIndex) => {
          if (offSet.has(dayIndex)) return SHIFTS.OFF;
          if (comSet.has(dayIndex)) return SHIFTS.V_M7_COM;

          const shortIndex = shortDays.indexOf(dayIndex);
          return (mask & (1 << shortIndex)) > 0 ? SHIFTS.V_M7_APE : SHIFTS.V_M7_CIE;
        });

        if (longestConsecutiveWorkDays(shifts) > maxConsecutiveDays) {
          continue;
        }

        const pattern: WeekPattern = {
          key: shifts.map((shift) => shift.id).join("-"),
          shifts,
          worksSunday: shifts[6].id !== "OFF",
          shiftCounts: {
            ape: shifts.filter((shift) => shift.id === "V_M7_APE").length,
            cie: shifts.filter((shift) => shift.id === "V_M7_CIE").length,
            com: shifts.filter((shift) => shift.id === "V_M7_COM").length,
          },
        };

        patterns.push(pattern);
      }
    });
  });

  patternCache.set(maxConsecutiveDays, patterns);
  return patterns;
}

function minimumDotationForSundayMall(visibleSundayCount: number, minFreeSundays: number) {
  const baseCoverageDotation = Math.ceil((7 * COVERAGE_MIN) / 5);
  const maxWorkingVisibleSundaysPerSlot = visibleSundayCount - minFreeSundays;

  if (visibleSundayCount === 0) {
    return baseCoverageDotation;
  }

  if (maxWorkingVisibleSundaysPerSlot <= 0) {
    return null;
  }

  const sundayDrivenDotation = Math.ceil(
    (visibleSundayCount * COVERAGE_MIN) / maxWorkingVisibleSundaysPerSlot
  );

  return Math.max(baseCoverageDotation, sundayDrivenDotation);
}

function buildSundayPlan(
  weeks: LabDay[][],
  dotation: number,
  minFreeSundays: number,
  attemptIndex: number
) {
  const visibleSundayWeekIndexes = weeks
    .map((week, weekIndex) => ({ weekIndex, sunday: week[6] }))
    .filter(({ sunday }) => sunday?.inVisibleMonth && sunday?.isSunday)
    .map(({ weekIndex }) => weekIndex);

  const maxWorkingVisibleSundaysPerSlot = visibleSundayWeekIndexes.length - minFreeSundays;

  if (visibleSundayWeekIndexes.length === 0) {
    return { feasible: true as const, requiredWorkByWeek: new Map<number, Set<number>>() };
  }

  if (maxWorkingVisibleSundaysPerSlot <= 0) {
    return {
      feasible: false as const,
      reason:
        "La configuracion actual exige demasiados domingos libres y deja sin capacidad para cubrir los domingos visibles.",
    };
  }

  if (dotation * maxWorkingVisibleSundaysPerSlot < visibleSundayWeekIndexes.length * COVERAGE_MIN) {
    return {
      feasible: false as const,
      reason:
        "La dotacion no alcanza para cubrir los domingos visibles manteniendo el minimo de domingos libres solicitado.",
    };
  }

  const requiredWorkByWeek = new Map<number, Set<number>>();
  const remainingSundayBudget = Array.from({ length: dotation }, () => maxWorkingVisibleSundaysPerSlot);
  const assignedVisibleSundays = Array.from({ length: dotation }, () => 0);

  rotate(visibleSundayWeekIndexes, attemptIndex).forEach((weekIndex) => {
    const candidates = Array.from({ length: dotation }, (_, slotIndex) => slotIndex + 1)
      .filter((slotNumber) => remainingSundayBudget[slotNumber - 1] > 0)
      .sort((left, right) => {
        const remainingDiff =
          remainingSundayBudget[right - 1] - remainingSundayBudget[left - 1];
        if (remainingDiff !== 0) return remainingDiff;

        const assignedDiff =
          assignedVisibleSundays[left - 1] - assignedVisibleSundays[right - 1];
        if (assignedDiff !== 0) return assignedDiff;

        return seededNoise(attemptIndex, weekIndex, left) - seededNoise(attemptIndex, weekIndex, right);
      });

    if (candidates.length < COVERAGE_MIN) {
      return;
    }

    const selected = new Set(candidates.slice(0, COVERAGE_MIN));
    requiredWorkByWeek.set(weekIndex, selected);

    selected.forEach((slotNumber) => {
      remainingSundayBudget[slotNumber - 1] -= 1;
      assignedVisibleSundays[slotNumber - 1] += 1;
    });
  });

  if (requiredWorkByWeek.size !== visibleSundayWeekIndexes.length) {
    return {
      feasible: false as const,
      reason: "No se logro distribuir la cobertura minima de domingos entre los slots disponibles.",
    };
  }

  return {
    feasible: true as const,
    requiredWorkByWeek,
  };
}

function patternScore(
  pattern: WeekPattern,
  currentCoverage: number[],
  apeCount: number,
  cieCount: number,
  requiredSunday: boolean | null,
  attemptIndex: number,
  weekIndex: number,
  slotNumber: number
) {
  if (requiredSunday !== null && pattern.worksSunday !== requiredSunday) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  for (let dayIndex = 0; dayIndex < pattern.shifts.length; dayIndex += 1) {
    const shift = pattern.shifts[dayIndex];
    const current = currentCoverage[dayIndex];

    if (shift.id === "OFF") {
      score += current >= COVERAGE_MIN ? 0.75 : -4;
      continue;
    }

    const deficit = Math.max(0, COVERAGE_MIN - current);
    score += deficit * 10 + 1.5;

    if (shift.id === "V_M7_COM") {
      score += dayIndex >= 5 ? 2 : 0.75;
    }

    if (dayIndex === 6 && requiredSunday === true) {
      score += 4;
    }
  }

  const beforeGap = Math.abs(apeCount - cieCount);
  const afterGap = Math.abs(
    apeCount + pattern.shiftCounts.ape - (cieCount + pattern.shiftCounts.cie)
  );
  score += (beforeGap - afterGap) * 2;
  score += seededNoise(attemptIndex, weekIndex, slotNumber, pattern.key.length) * 1.5;

  return score;
}

function buildMetrics(
  assignments: LabAssignment[],
  visibleDays: LabDay[],
  effectiveDays: LabDay[],
  weekCount: number,
  dotation: number
): ProposalMetrics {
  const visibleDateSet = new Set(visibleDays.map((day) => day.date));
  const dayByDate = new Map(visibleDays.map((day) => [day.date, day]));

  const shiftCounts: Record<string, number> = {
    V_M7_APE: 0,
    V_M7_CIE: 0,
    V_M7_COM: 0,
  };
  const coverageByDate: Record<string, number> = {};
  const effectiveCoverageByDate: Record<string, number> = {};
  const slotHours: Record<string, number> = {};
  const weeklyHoursBySlot: Record<string, number[]> = {};
  const freeSundaysBySlot = new Map<number, number>();

  for (let slot = 1; slot <= dotation; slot += 1) {
    slotHours[String(slot)] = 0;
    weeklyHoursBySlot[String(slot)] = Array.from({ length: weekCount }, () => 0);
    freeSundaysBySlot.set(slot, 0);
  }

  effectiveDays.forEach((day) => {
    effectiveCoverageByDate[day.date] = 0;
    if (day.inVisibleMonth) {
      coverageByDate[day.date] = 0;
    }
  });

  assignments.forEach((assignment) => {
    if (!assignment.isOff) {
      effectiveCoverageByDate[assignment.date] = (effectiveCoverageByDate[assignment.date] ?? 0) + 1;
    }

    weeklyHoursBySlot[String(assignment.slotNumber)][assignment.weekIndex] += assignment.laborHours;

    if (!visibleDateSet.has(assignment.date)) {
      return;
    }

    if (!assignment.isOff) {
      shiftCounts[assignment.shiftId] = (shiftCounts[assignment.shiftId] ?? 0) + 1;
      coverageByDate[assignment.date] = (coverageByDate[assignment.date] ?? 0) + 1;
    }

    slotHours[String(assignment.slotNumber)] += assignment.laborHours;

    const day = dayByDate.get(assignment.date);
    if (day?.isSunday && assignment.isOff) {
      freeSundaysBySlot.set(
        assignment.slotNumber,
        (freeSundaysBySlot.get(assignment.slotNumber) ?? 0) + 1
      );
    }
  });

  const freeSundays = Array.from(freeSundaysBySlot.values());
  const totalHours = Object.values(slotHours).reduce((sum, value) => sum + value, 0);
  const effectiveCoverageValues = effectiveDays.map((day) => effectiveCoverageByDate[day.date] ?? 0);

  return {
    averageHours: Number((totalHours / Math.max(dotation, 1)).toFixed(2)),
    minFreeSundays: freeSundays.length > 0 ? Math.min(...freeSundays) : 0,
    maxFreeSundays: freeSundays.length > 0 ? Math.max(...freeSundays) : 0,
    minCoverage: effectiveCoverageValues.length > 0 ? Math.min(...effectiveCoverageValues) : 0,
    coverageDeficitDays: effectiveDays
      .filter((day) => (effectiveCoverageByDate[day.date] ?? 0) < COVERAGE_MIN)
      .map(
        (day) =>
          `${day.date} (${effectiveCoverageByDate[day.date] ?? 0}/${COVERAGE_MIN})`
      ),
    shiftCounts,
    coverageByDate,
    slotHours,
    weeklyHoursBySlot,
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

  return Number(
    Math.max(
      1,
      120 -
        apeVsCieGap -
        sundaySpreadGap * 4 -
        coveragePenalty -
        metrics.coverageDeficitDays.length * 20 -
        Math.max(0, COVERAGE_MIN - metrics.minCoverage) * 10
    ).toFixed(2)
  );
}

function buildAttempt(
  input: OptimizerLabInput,
  weeks: LabDay[][],
  visibleDays: LabDay[],
  effectiveDays: LabDay[],
  attemptIndex: number
): ProposalAttempt {
  const patterns = buildCandidatePatterns(input.maxConsecutiveDays);
  const sundayPlan = buildSundayPlan(weeks, input.dotation, input.minFreeSundays, attemptIndex);

  if (!sundayPlan.feasible) {
    return { feasible: false, reason: sundayPlan.reason };
  }

  const assignments: LabAssignment[] = [];
  let apeCount = 0;
  let cieCount = 0;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const week = weeks[weekIndex];
    const coverage = Array.from({ length: 7 }, () => 0);
    const slotOrder = rotate(
      Array.from({ length: input.dotation }, (_, index) => index + 1),
      attemptIndex + weekIndex
    );

    for (const slotNumber of slotOrder) {
      const sundayWorkers = sundayPlan.requiredWorkByWeek.get(weekIndex);
      const requiredSunday = sundayWorkers ? sundayWorkers.has(slotNumber) : null;

      let bestPattern: WeekPattern | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      patterns.forEach((pattern) => {
        const score = patternScore(
          pattern,
          coverage,
          apeCount,
          cieCount,
          requiredSunday,
          attemptIndex,
          weekIndex,
          slotNumber
        );

        if (score > bestScore) {
          bestScore = score;
          bestPattern = pattern;
        }
      });

      if (bestPattern === null) {
        return {
          feasible: false,
          reason: "No se encontro un patron semanal compatible para uno de los slots del calendario.",
        };
      }

      const chosenPattern: WeekPattern = bestPattern;

      chosenPattern.shifts.forEach((shift, dayIndex) => {
        const day = week[dayIndex];
        assignments.push({
          slotNumber,
          date: day.date,
          shiftId: shift.id,
          label: shift.label,
          laborHours: shift.laborHours,
          isOff: shift.id === "OFF",
          weekIndex,
        });

        if (shift.id !== "OFF") {
          coverage[dayIndex] += 1;
        }
      });

      apeCount += chosenPattern.shiftCounts.ape;
      cieCount += chosenPattern.shiftCounts.cie;
    }
  }

  const metrics = buildMetrics(assignments, visibleDays, effectiveDays, weeks.length, input.dotation);
  const weeklyHoursOkay = Object.values(metrics.weeklyHoursBySlot).every((weeksBySlot) =>
    weeksBySlot.every((hours) => hours === input.weeklyHoursTarget)
  );

  if (!weeklyHoursOkay) {
    return {
      feasible: false,
      reason: "La propuesta generada no logro mantener 42 horas exactas en todas las semanas extendidas.",
    };
  }

  if (metrics.coverageDeficitDays.length > 0) {
    return {
      feasible: false,
      reason: `Cobertura insuficiente en ${metrics.coverageDeficitDays[0]}.`,
    };
  }

  if (metrics.minFreeSundays < input.minFreeSundays) {
    return {
      feasible: false,
      reason: "La propuesta no alcanza el minimo de domingos libres solicitado.",
    };
  }

  const visibleDateSet = new Set(visibleDays.map((day) => day.date));
  const visibleAssignments = assignments.filter((assignment) => visibleDateSet.has(assignment.date));
  const hash = visibleAssignments
    .map((assignment) => `${assignment.slotNumber}:${assignment.date}:${assignment.shiftId}`)
    .join("|");

  return {
    feasible: true,
    hash,
    proposal: {
      id: `prop-${attemptIndex + 1}`,
      score: computeScore(metrics),
      assignments: visibleAssignments,
      metrics,
    },
  };
}

function buildFeasibilityMessages(
  input: OptimizerLabInput,
  visibleDays: LabDay[],
  minimumSuggested: number | null,
  proposals: OptimizerProposal[],
  failedReasons: string[]
) {
  const messages: string[] = [];
  const visibleSundays = visibleDays.filter((day) => day.isSunday).length;

  if (input.weeklyHoursTarget !== 42) {
    messages.push("El playground actual solo soporta semanas exactas de 42 horas.");
  }

  if (input.maxConsecutiveDays < 5) {
    messages.push("Con la configuracion actual, el caso dominical necesita permitir al menos 5 dias consecutivos.");
  }

  if (input.minFreeSundays > visibleSundays) {
    messages.push("El mes visible no tiene suficientes domingos para cumplir la meta solicitada.");
  }

  if (minimumSuggested === null) {
    messages.push(
      "La combinacion entre domingos libres y cobertura minima hace imposible cubrir domingos visibles con este escenario."
    );
  } else if (input.dotation < minimumSuggested) {
    messages.push(
      `Dotacion insuficiente para cobertura dominical con ${input.minFreeSundays} domingos libres. Se sugieren al menos ${minimumSuggested} slots.`
    );
  }

  if (proposals.length > 0) {
    messages.push(
      `Se generaron ${proposals.length} propuesta(s) factibles con cobertura minima ${COVERAGE_MIN} en el rango extendido.`
    );
  } else {
    failedReasons
      .filter((reason, index, allReasons) => allReasons.indexOf(reason) === index)
      .slice(0, 3)
      .forEach((reason) => messages.push(reason));
  }

  if (messages.length === 0) {
    messages.push("No se encontro una propuesta factible con los parametros actuales.");
  }

  return messages;
}

export function runOptimizerLab(input: OptimizerLabInput): OptimizerLabResponse {
  const { visibleDays, effectiveDays } = getMonthDates(input.year, input.month);
  const weeks = buildWeeks(effectiveDays);
  const minimumSuggested = minimumDotationForSundayMall(
    visibleDays.filter((day) => day.isSunday).length,
    input.minFreeSundays
  );

  const proposals: OptimizerProposal[] = [];
  const failedReasons: string[] = [];
  const seen = new Set<string>();

  const canAttemptSolve =
    input.weeklyHoursTarget === 42 &&
    input.maxConsecutiveDays >= 5 &&
    minimumSuggested !== null &&
    input.dotation >= minimumSuggested;

  if (canAttemptSolve) {
    const attemptCount = Math.max(input.numProposals * 6, 10);

    for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
      const attempt = buildAttempt(input, weeks, visibleDays, effectiveDays, attemptIndex);
      if (!attempt.feasible) {
        failedReasons.push(attempt.reason);
        continue;
      }

      if (seen.has(attempt.hash)) {
        continue;
      }

      seen.add(attempt.hash);
      proposals.push(attempt.proposal);

      if (proposals.length >= input.numProposals) {
        break;
      }
    }
  }

  proposals.sort((left, right) => right.score - left.score);

  const diagnostic: OptimizerDiagnostic = {
    categoryLabel: "Ventas Mall Dominical",
    solverMode: input.solverMode,
    dotationAvailable: input.dotation,
    minimumSuggested,
    feasible: proposals.length > 0,
    messages: buildFeasibilityMessages(input, visibleDays, minimumSuggested, proposals, failedReasons),
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
