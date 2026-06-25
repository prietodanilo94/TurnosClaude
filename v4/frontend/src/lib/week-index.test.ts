import { describe, expect, it } from "vitest";
import { getWeekIndex } from "./week-index";

// These are pinning tests — they lock the formula output to known-correct values.
// If any of these fail after a code change, the rotation formula has been altered
// and all future calendar generations will produce different shift assignments.
describe("getWeekIndex — epoch-based rotation anchor (DO NOT CHANGE FORMULA)", () => {
  it("returns 2943 for 2026-06-01 (Monday) — verified Quilín jun 2026 anchor", () => {
    // 2026-06-01 is a Monday. isoWeek=2943, 2943%4=3 → Sem4 for slot 1.
    const monday = new Date("2026-06-02T00:00:00.000Z"); // UTC midnight Monday
    expect(getWeekIndex(monday)).toBe(2943);
  });

  it("returns 2939 for 2026-05-04 (Monday) — verified May 2026 anchor", () => {
    const monday = new Date("2026-05-04T00:00:00.000Z");
    expect(getWeekIndex(monday)).toBe(2939);
  });

  it("increments by 1 for consecutive Mondays", () => {
    const w1 = new Date("2026-06-01T00:00:00.000Z");
    const w2 = new Date("2026-06-08T00:00:00.000Z");
    expect(getWeekIndex(w2) - getWeekIndex(w1)).toBe(1);
  });

  it("returns a consistent modulo for 4-week rotation cycles", () => {
    // Week index mod 4 determines which rotation week a slot uses.
    // These values are load-bearing — existing calendars depend on them.
    expect(getWeekIndex(new Date("2026-06-01T00:00:00.000Z")) % 4).toBe(3);
    expect(getWeekIndex(new Date("2026-06-08T00:00:00.000Z")) % 4).toBe(0);
    expect(getWeekIndex(new Date("2026-06-15T00:00:00.000Z")) % 4).toBe(1);
    expect(getWeekIndex(new Date("2026-06-22T00:00:00.000Z")) % 4).toBe(2);
  });
});
