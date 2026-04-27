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
          offByDay.set(template[weekIndex], (offByDay.get(template[weekIndex]) ?? 0) + 1);
        }
        for (const count of offByDay.values()) {
          expect(count).toBeLessThan(size);
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

  it("exposes monthly planning risks in the smaller dotations", () => {
    const scenario4 = getFactibilityScenarios().find((item) => item.headcount === 4);
    const analysis = analyzeFactibilityOption(scenario4!.options[0]);
    expect(analysis.violations.some((item) => item.type === "consecutive")).toBe(true);
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
