import { describe, expect, it } from "vitest";
import { runOptimizerLab } from "./engine";
import type { OptimizerLabInput } from "./types";

const baseInput: OptimizerLabInput = {
  category: "ventas_mall_dominical",
  solverMode: "heuristic",
  year: 2026,
  month: 4,
  dotation: 4,
  weeklyHoursTarget: 42,
  maxConsecutiveDays: 6,
  minFreeSundays: 2,
  numProposals: 3,
  timeLimitSeconds: 30,
};

describe("runOptimizerLab", () => {
  it("diagnostica insuficiencia cuando la dotacion no alcanza para domingos y 42h", () => {
    const result = runOptimizerLab({
      ...baseInput,
      dotation: 3,
    });

    expect(result.diagnostic.feasible).toBe(false);
    expect(result.diagnostic.minimumSuggested).toBe(4);
    expect(result.proposals).toHaveLength(0);
    expect(
      result.diagnostic.messages.some((message) => message.includes("Dotacion insuficiente"))
    ).toBe(true);
  });

  it("genera propuestas factibles con 42h exactas por semana extendida", () => {
    const result = runOptimizerLab(baseInput);

    expect(result.diagnostic.feasible).toBe(true);
    expect(result.proposals.length).toBeGreaterThan(0);

    result.proposals.forEach((proposal) => {
      expect(proposal.metrics.coverageDeficitDays).toHaveLength(0);
      expect(proposal.metrics.minFreeSundays).toBeGreaterThanOrEqual(2);

      Object.values(proposal.metrics.weeklyHoursBySlot).forEach((weeklyHours) => {
        weeklyHours.forEach((hours) => {
          expect(hours).toBe(42);
        });
      });
    });
  });

  it("rechaza configuraciones que dejan todos los domingos libres sin capacidad de cobertura", () => {
    const result = runOptimizerLab({
      ...baseInput,
      minFreeSundays: 4,
    });

    expect(result.diagnostic.feasible).toBe(false);
    expect(result.diagnostic.minimumSuggested).toBeNull();
    expect(result.proposals).toHaveLength(0);
    expect(
      result.diagnostic.messages.some((message) => message.includes("domingos visibles"))
    ).toBe(true);
  });
});
