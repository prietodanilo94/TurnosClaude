import { describe, expect, it } from "vitest";
import { generateCalendar } from "./generator";

describe("generateCalendar", () => {
  it("creates one slot per active worker across the visible month weeks", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, 4);

    expect(result.totalWorkers).toBe(4);
    expect(result.slots).toHaveLength(4);
    expect(result.slots.map((slot) => slot.slotNumber)).toEqual([1, 2, 3, 4]);
    expect(Object.keys(result.slots[0].days)).toContain("2026-05-01");
    expect(Object.keys(result.slots[0].days)).toContain("2026-05-31");
  });

  it("warns when a four-week rotation has only three workers", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, 3);

    expect(result.alert).toContain("3 vendedores");
  });

  it("warns when a branch has only one worker", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, 1);

    expect(result.alert).toContain("Solo hay 1 vendedor");
  });
});
