import { describe, expect, it } from "vitest";
import { validateCalendarForPublish } from "./validation";
import type { CalendarSlot } from "@/types";

const baseSlot: CalendarSlot = {
  slotNumber: 1,
  days: {
    "2026-05-04": { start: "10:00", end: "18:00" },
    "2026-05-05": null,
  },
};

describe("validateCalendarForPublish", () => {
  it("blocks saving when a slot with shifts has no assigned worker", () => {
    const result = validateCalendarForPublish({
      year: 2026,
      month: 5,
      slots: [baseSlot],
      assignments: {},
      workerMap: {},
    });

    expect(result.canSave).toBe(false);
    expect(result.errors.some((issue) => issue.code === "unassigned_slot")).toBe(true);
  });

  it("blocks saving when an assigned worker is blocked on a shift date", () => {
    const result = validateCalendarForPublish({
      year: 2026,
      month: 5,
      slots: [baseSlot],
      assignments: { "1": "worker-1" },
      workerMap: { "worker-1": "Juan Perez" },
      blockMap: {
        "worker-1": {
          "2026-05-04": "Licencia",
        },
      },
    });

    expect(result.canSave).toBe(false);
    expect(result.errors.some((issue) => issue.code === "blocked_worker")).toBe(true);
  });

  it("allows saving when all shifts are assigned and there are no blocking issues", () => {
    const result = validateCalendarForPublish({
      year: 2026,
      month: 5,
      slots: [baseSlot],
      assignments: { "1": "worker-1" },
      workerMap: { "worker-1": "Juan Perez" },
    });

    expect(result.canSave).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

