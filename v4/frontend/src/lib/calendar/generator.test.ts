import { describe, expect, it } from "vitest";
import { generateCalendar } from "./generator";

describe("generateCalendar", () => {
  it("creates one slot per active worker across the visible month weeks", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, [0, 1, 2, 3]);

    expect(result.totalWorkers).toBe(4);
    expect(result.slots).toHaveLength(4);
    expect(result.slots.map((slot) => slot.slotNumber)).toEqual([1, 2, 3, 4]);
    expect(Object.keys(result.slots[0].days)).toContain("2026-05-01");
    expect(Object.keys(result.slots[0].days)).toContain("2026-05-31");
  });

  it("warns when a four-week rotation has only three workers", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, [0, 1, 2]);

    expect(result.alert).toContain("3 vendedores");
  });

  it("warns when a branch has only one worker", () => {
    const result = generateCalendar("ventas_mall_7d", 2026, 5, [0]);

    expect(result.alert).toContain("Solo hay 1 vendedor");
  });

  it("keeps the same rotation week for a worker's anchor regardless of their position in the array", () => {
    // Si el ancla (no la posicion) determina la rotacion, un trabajador con
    // anchor=2 debe producir el mismo patron de dias este en la posicion
    // que este (slot 1, 2, 3...) dentro de slotAnchors.
    const asSlot1 = generateCalendar("ventas_standalone", 2026, 6, [2]);
    const asSlot3 = generateCalendar("ventas_standalone", 2026, 6, [9, 9, 2]);

    expect(asSlot1.slots[0].days).toEqual(asSlot3.slots[2].days);
  });
});
