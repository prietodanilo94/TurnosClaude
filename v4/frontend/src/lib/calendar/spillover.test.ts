import { describe, expect, it } from "vitest";
import { diffSpilloverChanges, extractNextMonthSpillover, overlayDaysByWorker } from "./spillover";
import type { CalendarSlot } from "@/types";

const S = { start: "10:00", end: "19:00" };

describe("extractNextMonthSpillover", () => {
  it("extracts next-month dates per assigned worker, including explicit libres", () => {
    const slots: CalendarSlot[] = [
      { slotNumber: 1, days: { "2026-07-31": S, "2026-08-01": S, "2026-08-02": null } },
      { slotNumber: 2, days: { "2026-08-01": null, "2026-08-02": S } },
    ];
    const out = extractNextMonthSpillover(slots, { "1": "w1", "2": "w2" }, 2026, 7);
    expect(out).toHaveLength(4);
    expect(out.find((d) => d.workerId === "w1" && d.dateStr === "2026-08-01")?.shift).toEqual(S);
    expect(out.find((d) => d.workerId === "w1" && d.dateStr === "2026-08-02")?.shift).toBeNull();
    expect(out.some((d) => d.dateStr === "2026-07-31")).toBe(false);
  });

  it("handles december -> january", () => {
    const slots: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-12-31": S, "2027-01-01": S } }];
    const out = extractNextMonthSpillover(slots, { "1": "w1" }, 2026, 12);
    expect(out).toHaveLength(1);
    expect(out[0].dateStr).toBe("2027-01-01");
  });

  it("skips unassigned slots", () => {
    const slots: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": S } }];
    expect(extractNextMonthSpillover(slots, { "1": null }, 2026, 7)).toEqual([]);
  });
});

describe("overlayDaysByWorker", () => {
  const targetSlots: CalendarSlot[] = [
    { slotNumber: 1, days: { "2026-08-01": null, "2026-08-02": S, "2026-08-03": S } },
  ];
  const targetAsg = { "1": "w1" };

  it("overwrites matching worker/date cells and reports changes", () => {
    const { slots, changed, applied } = overlayDaysByWorker(targetSlots, targetAsg, [
      { workerId: "w1", dateStr: "2026-08-01", shift: S },      // libre -> turno
      { workerId: "w1", dateStr: "2026-08-02", shift: null },    // turno -> libre
      { workerId: "w1", dateStr: "2026-08-03", shift: S },       // igual, sin cambio
    ]);
    expect(changed).toBe(true);
    expect(applied).toBe(2);
    expect(slots[0].days["2026-08-01"]).toEqual(S);
    expect(slots[0].days["2026-08-02"]).toBeNull();
    // el original no se muta
    expect(targetSlots[0].days["2026-08-01"]).toBeNull();
  });

  it("skips workers not assigned in the target and dates outside its grid", () => {
    const { changed, applied, skippedWorkers } = overlayDaysByWorker(targetSlots, targetAsg, [
      { workerId: "w9", dateStr: "2026-08-01", shift: S },
      { workerId: "w1", dateStr: "2026-08-20", shift: S }, // fecha fuera de la grilla objetivo
    ]);
    expect(changed).toBe(false);
    expect(applied).toBe(0);
    expect(skippedWorkers).toEqual(["w9"]);
  });
});

describe("diffSpilloverChanges", () => {
  const asg = { "1": "w1" };

  it("BUG REAL (2026-07-13): editar un dia que NO es remanente no genera cambios a propagar", () => {
    // El remanente (dias de agosto) es identico antes y despues: solo cambio
    // un dia de julio que no tiene nada que ver.
    const before: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-07-15": S, "2026-08-01": null, "2026-08-02": null } }];
    const after: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-07-15": null, "2026-08-01": null, "2026-08-02": null } }];
    const changed = diffSpilloverChanges(before, asg, after, asg, 2026, 7);
    expect(changed).toEqual([]);
  });

  it("detecta cuando el remanente mismo cambio de valor", () => {
    const before: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": null } }];
    const after: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": S } }];
    const changed = diffSpilloverChanges(before, asg, after, asg, 2026, 7);
    expect(changed).toEqual([{ workerId: "w1", dateStr: "2026-08-01", shift: S }]);
  });

  it("sin estado previo (primer guardado del mes), todo el remanente cuenta como cambio", () => {
    const after: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": S, "2026-08-02": null } }];
    const changed = diffSpilloverChanges(null, null, after, asg, 2026, 7);
    expect(changed).toHaveLength(2);
  });

  it("un trabajador que perdio su slot deja de aparecer en el remanente: se propaga como libre", () => {
    const before: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": S } }];
    const after: CalendarSlot[] = [{ slotNumber: 1, days: { "2026-08-01": S } }];
    const changed = diffSpilloverChanges(before, asg, after, { "1": null }, 2026, 7);
    expect(changed).toEqual([{ workerId: "w1", dateStr: "2026-08-01", shift: null }]);
  });
});
