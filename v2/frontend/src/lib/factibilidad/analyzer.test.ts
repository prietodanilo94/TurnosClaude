import { describe, expect, it } from "vitest";
import { buildGroupOffTemplates, analyzeFactibilityOption } from "./analyzer";
import { getFactibilityScenarios } from "./scenarios";

describe("buildGroupOffTemplates", () => {
  it("builds workable templates for groups of 2 to 6", () => {
    for (const size of [2, 3, 4, 5, 6]) {
      const templates = buildGroupOffTemplates(size);
      expect(templates).toHaveLength(size);
      for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
        const offByDay = new Map<string, number>();
        for (const template of templates) {
          for (const day of template[weekIndex]) {
            offByDay.set(day, (offByDay.get(day) ?? 0) + 1);
          }
        }
        for (const count of Array.from(offByDay.values())) {
          expect(count).toBeLessThan(size);
        }
      }
    }
  });

  it("gives each worker exactly 2 free days per week", () => {
    for (const size of [2, 3, 4, 5, 6]) {
      const templates = buildGroupOffTemplates(size);
      for (const template of templates) {
        for (const weekDays of template) {
          expect(weekDays).toHaveLength(2);
        }
      }
    }
  });
});

describe("factibility scenarios", () => {
  it("ships interactive options with base coverage preserved", () => {
    const scenarios = getFactibilityScenarios();
    for (const scenario of scenarios) {
      for (const option of scenario.options) {
        const analysis = analyzeFactibilityOption(option);
        const coverageViolations = analysis.violations.filter(
          (item) => item.type === "coverage" && item.severity === "error"
        );
        expect(coverageViolations).toHaveLength(0);
      }
    }
  });

  it("all modeled scenarios pass every rule in cycle view", () => {
    const scenarios = getFactibilityScenarios();
    for (const scenario of scenarios) {
      for (const option of scenario.options) {
        const analysis = analyzeFactibilityOption(option);
        expect(analysis.feasible).toBe(true);
      }
    }
  });

  it("projects the pattern onto a real month with 5 Sundays", () => {
    const scenario6 = getFactibilityScenarios().find((item) => item.headcount === 6);
    const analysis = analyzeFactibilityOption(scenario6!.options[1], {
      mode: "month",
      year: 2026,
      month: 5,
    });
    expect(analysis.totalSundaysInScope).toBe(5);
    expect(analysis.visibleWeekCount).toBeGreaterThanOrEqual(5);
    expect(
      analysis.violations.filter((item) => item.type === "coverage" && item.severity === "error")
    ).toHaveLength(0);
  });
});
