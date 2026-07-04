import { describe, expect, it } from "vitest";
import { extractPrevMonthTail, mergePrevMonthTails } from "./prevMonthTail";

const SHIFT = { start: "09:00", end: "18:00" };

describe("extractPrevMonthTail", () => {
  it("extracts the last 7 real days per assigned worker, with explicit null for libre days", () => {
    const prevCal = {
      slotsData: JSON.stringify([
        {
          slotNumber: 1,
          days: {
            "2026-06-28": SHIFT,
            "2026-06-29": SHIFT,
            "2026-06-30": null, // libre publicado
            // 2026-06-24..27 sin entrada en la grilla
          },
        },
      ]),
      assignments: JSON.stringify({ "1": "w1" }),
    };

    const tail = extractPrevMonthTail(prevCal, 2026, 6);

    expect(Object.keys(tail)).toEqual(["w1"]);
    // junio tiene 30 dias -> cola = 24..30
    expect(Object.keys(tail.w1).sort()).toEqual([
      "2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27",
      "2026-06-28", "2026-06-29", "2026-06-30",
    ]);
    expect(tail.w1["2026-06-28"]).toEqual(SHIFT);
    expect(tail.w1["2026-06-30"]).toBeNull();
    expect(tail.w1["2026-06-24"]).toBeNull(); // sin entrada = libre real
  });

  it("skips slots without an assigned worker", () => {
    const prevCal = {
      slotsData: JSON.stringify([{ slotNumber: 1, days: { "2026-06-30": SHIFT } }]),
      assignments: JSON.stringify({ "1": null }),
    };
    expect(extractPrevMonthTail(prevCal, 2026, 6)).toEqual({});
  });

  it("returns empty map for missing calendar or malformed JSON", () => {
    expect(extractPrevMonthTail(null, 2026, 6)).toEqual({});
    expect(extractPrevMonthTail({ slotsData: "not json", assignments: "{}" }, 2026, 6)).toEqual({});
  });
});

describe("mergePrevMonthTails", () => {
  it("merges tails from multiple team calendars", () => {
    const merged = mergePrevMonthTails([
      { w1: { "2026-06-30": SHIFT } },
      { w2: { "2026-06-30": null } },
    ]);
    expect(Object.keys(merged).sort()).toEqual(["w1", "w2"]);
  });
});
