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

  describe("prevMonthShifts: cola real del mes anterior (F11 Fase 0)", () => {
    const SHIFT = { start: "09:00", end: "18:00" }; // 8h trabajadas

    // Grilla de julio 2026: su semana frontera (lun 29-jun .. dom 5-jul)
    // ASUME que 29 y 30 de junio fueron libres. Julio trabaja mie 1 a sab 4.
    const julySlot: CalendarSlot = {
      slotNumber: 1,
      days: {
        "2026-06-29": null,
        "2026-06-30": null,
        "2026-07-01": SHIFT,
        "2026-07-02": SHIFT,
        "2026-07-03": SHIFT,
        "2026-07-04": SHIFT,
        "2026-07-05": null,
        "2026-07-06": null,
      },
    };

    const base = {
      year: 2026,
      month: 7,
      slots: [julySlot],
      assignments: { "1": "worker-1" },
      workerMap: { "worker-1": "Juan Perez" },
    };

    it("detects a consecutive run crossing the boundary that the grid alone cannot see", () => {
      // Sin cola: 4 dias seguidos, sin problema.
      const withoutTail = validateCalendarForPublish(base);
      expect(withoutTail.errors.some((i) => i.code === "consecutive_days_exceeded")).toBe(false);

      // Realidad de junio: trabajo 25..30 (6 dias). 6 + 4 de julio = 10 seguidos.
      const withTail = validateCalendarForPublish({
        ...base,
        prevMonthShifts: {
          "worker-1": {
            "2026-06-24": null,
            "2026-06-25": SHIFT,
            "2026-06-26": SHIFT,
            "2026-06-27": SHIFT,
            "2026-06-28": SHIFT,
            "2026-06-29": SHIFT,
            "2026-06-30": SHIFT,
          },
        },
      });
      const runIssue = withTail.errors.find((i) => i.code === "consecutive_days_exceeded");
      expect(runIssue).toBeDefined();
      expect(runIssue!.title).toContain("10");
    });

    it("uses real prev-month hours for the boundary week instead of the grid assumption", () => {
      // Grilla: 29-30 jun libres -> semana frontera 4x8 = 32h, ok.
      // Realidad: 29 y 30 trabajados -> 6x8 = 48h > 42h.
      const result = validateCalendarForPublish({
        ...base,
        prevMonthShifts: {
          "worker-1": { "2026-06-29": SHIFT, "2026-06-30": SHIFT },
        },
      });
      expect(result.errors.some((i) => i.code === "weekly_hours_high")).toBe(true);
      expect(result.exceeds42hLimit).toBe(true);
    });

    it("clears a false positive when real prev-month data says those days were libre", () => {
      // Grilla con 29-30 jun trabajados (asumidos por patron) -> 48h frontera.
      const gridAssumesWork: CalendarSlot = {
        slotNumber: 1,
        days: { ...julySlot.days, "2026-06-29": SHIFT, "2026-06-30": SHIFT },
      };
      const withoutTail = validateCalendarForPublish({ ...base, slots: [gridAssumesWork] });
      expect(withoutTail.errors.some((i) => i.code === "weekly_hours_high")).toBe(true);

      // Realidad: libres -> 32h, sin error.
      const withTail = validateCalendarForPublish({
        ...base,
        slots: [gridAssumesWork],
        prevMonthShifts: { "worker-1": { "2026-06-29": null, "2026-06-30": null } },
      });
      expect(withTail.errors.some((i) => i.code === "weekly_hours_high")).toBe(false);
    });

    it("reports a fully past >42h week as error but does not hard-block the save", () => {
      const result = validateCalendarForPublish({
        ...base,
        prevMonthShifts: {
          "worker-1": { "2026-06-29": SHIFT, "2026-06-30": SHIFT },
        },
        todayStr: "2026-07-20", // la semana frontera termino el 2026-07-05
      });
      expect(result.errors.some((i) => i.code === "weekly_hours_high")).toBe(true);
      expect(result.exceeds42hLimit).toBe(false);
    });

    it("still hard-blocks when the offending week is current or future", () => {
      const result = validateCalendarForPublish({
        ...base,
        prevMonthShifts: {
          "worker-1": { "2026-06-29": SHIFT, "2026-06-30": SHIFT },
        },
        todayStr: "2026-07-03", // dentro de la semana frontera
      });
      expect(result.exceeds42hLimit).toBe(true);
    });
  });
});

