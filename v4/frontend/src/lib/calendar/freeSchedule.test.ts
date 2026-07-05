import { describe, expect, it } from "vitest";
import {
  stateFromCalendar, materializeTeam, setCell, applyToCells,
  copyRow, copyWeek, weekdayDatesOfMonth,
  rowWeekHours, rowMaxRun, rowFreeSundays, diffStates,
} from "./freeSchedule";

const S = { start: "10:00", end: "19:00" }; // 9h span - 1h = 8h trabajadas

describe("stateFromCalendar / materializeTeam (ida y vuelta)", () => {
  it("builds state from a saved calendar and materializes it back", () => {
    const slots = [
      { slotNumber: 1, days: { "2026-07-01": S, "2026-07-02": null } },
      { slotNumber: 2, days: { "2026-07-01": null, "2026-07-02": S } },
    ];
    const assignments = { "1": "w1", "2": "w2" };

    const state = stateFromCalendar(slots, assignments);
    expect(state.w1["2026-07-01"]).toEqual(S);
    expect(state.w1["2026-07-02"]).toBeUndefined();
    expect(state.w2["2026-07-02"]).toEqual(S);

    const grid = ["2026-07-01", "2026-07-02"];
    const out = materializeTeam(state, [{ id: "w1", nombre: "Ana" }, { id: "w2", nombre: "Beto" }], grid);
    expect(out.assignments).toEqual({ "1": "w1", "2": "w2" });
    expect(out.slots[0].days).toEqual({ "2026-07-01": S, "2026-07-02": null });
    expect(out.slots[1].days).toEqual({ "2026-07-01": null, "2026-07-02": S });
  });

  it("skips unassigned slots when building state", () => {
    const state = stateFromCalendar(
      [{ slotNumber: 1, days: { "2026-07-01": S } }],
      { "1": null },
    );
    expect(state).toEqual({});
  });
});

describe("edicion", () => {
  it("setCell paints and erases without mutating the original state", () => {
    const s0 = {};
    const s1 = setCell(s0, "w1", "2026-07-01", S);
    expect(s1.w1["2026-07-01"]).toEqual(S);
    expect(s0).toEqual({});

    const s2 = setCell(s1, "w1", "2026-07-01", null);
    expect(s2.w1["2026-07-01"]).toBeUndefined();
    expect(s1.w1["2026-07-01"]).toEqual(S); // sin mutacion
  });

  it("applyToCells paints multiple cells at once", () => {
    const s = applyToCells({}, [
      { workerId: "w1", dateStr: "2026-07-01" },
      { workerId: "w2", dateStr: "2026-07-01" },
    ], S);
    expect(s.w1["2026-07-01"]).toEqual(S);
    expect(s.w2["2026-07-01"]).toEqual(S);
  });

  it("copyRow replicates a worker's schedule onto another, clearing extra days", () => {
    let s = setCell({}, "w1", "2026-07-01", S);
    s = setCell(s, "w2", "2026-07-02", S); // w2 tiene algo que w1 no
    const out = copyRow(s, "w1", "w2", ["2026-07-01", "2026-07-02"]);
    expect(out.w2["2026-07-01"]).toEqual(S);
    expect(out.w2["2026-07-02"]).toBeUndefined();
  });

  it("copyWeek maps dates by index for the given workers", () => {
    let s = setCell({}, "w1", "2026-07-06", S); // lunes semana 1
    const out = copyWeek(s, ["w1"],
      ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"],
      ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"],
    );
    expect(out.w1["2026-07-13"]).toEqual(S);
    expect(out.w1["2026-07-14"]).toBeUndefined();
  });

  it("weekdayDatesOfMonth returns all Tuesdays of July 2026", () => {
    // julio 2026: miercoles 1 -> martes 7, 14, 21, 28
    expect(weekdayDatesOfMonth(2026, 7, 1)).toEqual([
      "2026-07-07", "2026-07-14", "2026-07-21", "2026-07-28",
    ]);
  });
});

describe("metricas por fila", () => {
  it("rowWeekHours uses prev-month tail for boundary dates", () => {
    const state = setCell({}, "w1", "2026-07-01", S); // 8h
    const week = ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];
    const noTail = rowWeekHours(state, "w1", week, "2026-07-01");
    expect(noTail).toBe(8);
    const withTail = rowWeekHours(state, "w1", week, "2026-07-01", {
      "2026-06-29": S, "2026-06-30": S,
    });
    expect(withTail).toBe(24);
  });

  it("rowMaxRun counts runs crossing the month boundary via the tail", () => {
    let state = {};
    for (const d of ["2026-07-01", "2026-07-02", "2026-07-03"]) state = setCell(state, "w1", d, S);
    expect(rowMaxRun(state, "w1", "2026-07-01")).toBe(3);
    expect(rowMaxRun(state, "w1", "2026-07-01", { "2026-06-29": S, "2026-06-30": S, "2026-06-28": null })).toBe(5);
  });

  it("rowMaxRun ignores stale pre-month state dates when a real tail is provided", () => {
    let state = setCell({}, "w1", "2026-06-30", S); // dia de grilla guardado (asumido)
    state = setCell(state, "w1", "2026-07-01", S);
    // La cola real dice que el 30 estuvo libre -> racha 1, no 2.
    expect(rowMaxRun(state, "w1", "2026-07-01", { "2026-06-30": null })).toBe(1);
  });

  it("rowFreeSundays counts unpainted Sundays", () => {
    const sundays = ["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"];
    const state = setCell({}, "w1", "2026-07-05", S);
    expect(rowFreeSundays(state, "w1", sundays)).toBe(3);
  });
});

describe("diffStates", () => {
  it("emits ChangeItems only for month dates that actually changed", () => {
    const oldState = setCell({}, "w1", "2026-07-01", S);
    let newState = setCell(oldState, "w1", "2026-07-01", null); // quitado
    newState = setCell(newState, "w1", "2026-07-02", S); // agregado
    newState = setCell(newState, "w1", "2026-06-30", S); // fuera del mes -> ignorado

    const changes = diffStates(oldState, newState, { w1: "Ana" }, 2026, 7);
    expect(changes).toHaveLength(2);
    const removed = changes.find((c) => c.date === "2026-07-01")!;
    expect(removed.from).toBe("10:00-19:00");
    expect(removed.to).toBeNull();
    const added = changes.find((c) => c.date === "2026-07-02")!;
    expect(added.from).toBeNull();
    expect(added.to).toBe("10:00-19:00");
    expect(added.workerName).toBe("Ana");
    expect(added.dayLabel).toContain("Jul");
  });

  it("returns empty diff for identical states", () => {
    const s = setCell({}, "w1", "2026-07-01", S);
    expect(diffStates(s, s, { w1: "Ana" }, 2026, 7)).toEqual([]);
  });
});
