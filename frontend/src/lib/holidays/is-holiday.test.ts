import { describe, it, expect } from "vitest";
import { isHoliday } from "./is-holiday";
import type { Holiday } from "@/types/models";

const base: Omit<Holiday, "fecha" | "nombre" | "anio"> = {
  $id: "h1",
  $createdAt: "",
  $updatedAt: "",
  tipo: "irrenunciable",
};

const holidays: Holiday[] = [
  { ...base, $id: "h1", fecha: "2026-01-01", nombre: "Año Nuevo", anio: 2026 },
  { ...base, $id: "h2", fecha: "2026-05-01", nombre: "Día del Trabajador", anio: 2026 },
];

describe("isHoliday", () => {
  it("devuelve true para fecha que es feriado", () => {
    expect(isHoliday("2026-01-01", holidays)).toBe(true);
    expect(isHoliday("2026-05-01", holidays)).toBe(true);
  });

  it("devuelve false para fecha que no es feriado", () => {
    expect(isHoliday("2026-01-02", holidays)).toBe(false);
    expect(isHoliday("2026-12-25", holidays)).toBe(false);
  });

  it("devuelve false con lista vacía", () => {
    expect(isHoliday("2026-05-01", [])).toBe(false);
  });
});
