import { describe, expect, it } from "vitest";
import { computeCalendarDiff } from "./diff";
import type { CalendarSlot } from "@/types";

const S = { start: "10:00", end: "19:00" };

function slot(slotNumber: number, day: string, shift: { start: string; end: string } | null): CalendarSlot {
  return { slotNumber, days: { [day]: shift } };
}

describe("computeCalendarDiff", () => {
  it("detects day-by-day shift changes when the same worker keeps the slot", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", S)],
      [slot(1, "2026-07-15", { start: "11:00", end: "19:00" })],
      { "1": "w1" }, { "1": "w1" },
      { w1: "Ana" }, 2026, 7,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ workerId: "w1", from: "10:00-19:00", to: "11:00-19:00" });
  });

  it("BUG REAL (2026-07-13): un trabajador recien asignado a un slot vacio debe generar cambios, no desaparecer", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", null)],       // slot vacio
      [slot(1, "2026-07-15", S)],           // ahora con turno
      { "1": null }, { "1": "w1" },         // slot pasa de sin asignar a w1
      { w1: "Karina" }, 2026, 7,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ workerId: "w1", workerName: "Karina", from: null, to: "10:00-19:00" });
  });

  it("registra la salida del trabajador anterior y la entrada del nuevo cuando el slot se reasigna", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", S)],
      [slot(1, "2026-07-15", { start: "12:00", end: "20:00" })],
      { "1": "w1" }, { "1": "w2" }, // el slot pasa de w1 a w2
      { w1: "Ana", w2: "Beto" }, 2026, 7,
    );
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual(expect.objectContaining({ workerId: "w1", from: "10:00-19:00", to: null }));
    expect(changes).toContainEqual(expect.objectContaining({ workerId: "w2", from: null, to: "12:00-20:00" }));
  });

  it("registra la salida cuando un trabajador queda sin slot (turnos borrados)", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", S)],
      [slot(1, "2026-07-15", null)],
      { "1": "w1" }, { "1": null },
      { w1: "Ana" }, 2026, 7,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ workerId: "w1", from: "10:00-19:00", to: null });
  });

  it("BUG REAL (2026-07-13): un slot totalmente nuevo (trabajador recien contratado) debe generar cambios", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", S)],           // el slot 2 no existia antes
      [slot(1, "2026-07-15", S), slot(2, "2026-07-15", S)],
      { "1": "w1" }, { "1": "w1", "2": "w2" },
      { w1: "Ana", w2: "Nueva" }, 2026, 7,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ workerId: "w2", workerName: "Nueva", from: null, to: "10:00-19:00" });
  });

  it("no genera cambios cuando un slot vacio sigue vacio", () => {
    const changes = computeCalendarDiff(
      [slot(1, "2026-07-15", null)],
      [slot(1, "2026-07-15", null)],
      { "1": null }, { "1": null },
      {}, 2026, 7,
    );
    expect(changes).toHaveLength(0);
  });
});
