import { describe, it, expect } from "vitest";
import { calculateHours, isoWeek, totalMonthlyHours } from "./hours-calculator";
import type { CalendarAssignment } from "@/types/optimizer";

const SHIFT_5H = { id: "S_5H", duracion_minutos: 300 };
const SHIFT_10H = { id: "S_10H", duracion_minutos: 600 };

function makeAssignment(
  rut: string,
  date: string,
  shift_id = "S_5H"
): CalendarAssignment {
  return { id: `${rut}_${date}_${shift_id}`, worker_rut: rut, date, shift_id, worker_slot: 1 };
}

describe("isoWeek", () => {
  it("lunes 4 de mayo 2026 es semana 19", () => {
    expect(isoWeek("2026-05-04")).toBe(19);
  });

  it("domingo 31 de mayo 2026 es semana 22", () => {
    expect(isoWeek("2026-05-31")).toBe(22);
  });

  it("lunes 1 de enero 2024 es semana 1", () => {
    expect(isoWeek("2024-01-01")).toBe(1);
  });
});

describe("calculateHours", () => {
  it("acumula horas por trabajador y semana", () => {
    const assignments = [
      makeAssignment("A", "2026-05-04"),  // sem 19 → 5h
      makeAssignment("A", "2026-05-05"),  // sem 19 → 5h
      makeAssignment("A", "2026-05-11"),  // sem 20 → 5h
      makeAssignment("B", "2026-05-04"),  // sem 19 → 5h
    ];
    const result = calculateHours(assignments, [SHIFT_5H]);
    expect(result["A"][19]).toBe(10);
    expect(result["A"][20]).toBe(5);
    expect(result["B"][19]).toBe(5);
  });

  it("ignora turnos desconocidos (0 horas)", () => {
    const assignments = [makeAssignment("A", "2026-05-04", "DESCONOCIDO")];
    const result = calculateHours(assignments, [SHIFT_5H]);
    expect(result["A"][19]).toBe(0);
  });

  it("mezcla turnos de distinta duración", () => {
    const assignments = [
      makeAssignment("A", "2026-05-04", "S_5H"),
      makeAssignment("A", "2026-05-05", "S_10H"),
    ];
    const result = calculateHours(assignments, [SHIFT_5H, SHIFT_10H]);
    expect(result["A"][19]).toBe(15);
  });

  it("retorna objeto vacío para lista de asignaciones vacía", () => {
    expect(calculateHours([], [SHIFT_5H])).toEqual({});
  });
});

describe("totalMonthlyHours", () => {
  it("suma todas las semanas por trabajador", () => {
    const hoursMap = { A: { 19: 10, 20: 5, 21: 10 }, B: { 19: 5 } };
    const totals = totalMonthlyHours(hoursMap);
    expect(totals["A"]).toBe(25);
    expect(totals["B"]).toBe(5);
  });
});
