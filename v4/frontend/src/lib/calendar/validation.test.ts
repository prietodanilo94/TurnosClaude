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

  describe("weekly_hours_high across a month boundary", () => {
    // Semana lunes 29/jun - domingo 5/jul 2026: julio empieza miércoles,
    // así que su primera semana ISO nace en junio. 7 turnos de 8h = 56h,
    // muy por sobre el tope de 42h — pero repartidas 2 días en junio y
    // 5 en julio, ningún mes por separado llega a 42h si se filtra por mes.
    const boundarySlot: CalendarSlot = {
      slotNumber: 1,
      days: {
        "2026-06-29": { start: "09:00", end: "18:00" },
        "2026-06-30": { start: "09:00", end: "18:00" },
        "2026-07-01": { start: "09:00", end: "18:00" },
        "2026-07-02": { start: "09:00", end: "18:00" },
        "2026-07-03": { start: "09:00", end: "18:00" },
        "2026-07-04": { start: "09:00", end: "18:00" },
        "2026-07-05": { start: "09:00", end: "18:00" },
      },
    };

    it("detects the violation when validating the month where the week ends (July)", () => {
      const result = validateCalendarForPublish({
        year: 2026,
        month: 7,
        slots: [boundarySlot],
        assignments: { "1": "worker-1" },
        workerMap: { "worker-1": "Juan Perez" },
      });

      expect(result.errors.some((issue) => issue.code === "weekly_hours_high")).toBe(true);
    });

    it("detects the violation when validating the month where the week starts (June)", () => {
      const result = validateCalendarForPublish({
        year: 2026,
        month: 6,
        slots: [boundarySlot],
        assignments: { "1": "worker-1" },
        workerMap: { "worker-1": "Juan Perez" },
      });

      expect(result.errors.some((issue) => issue.code === "weekly_hours_high")).toBe(true);
    });
  });
});

