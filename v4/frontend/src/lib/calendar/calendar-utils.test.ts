import { describe, expect, it } from "vitest";
import { dowIndex, fmt, isFeriadoIrrenunciable, shiftDuration } from "./calendar-utils";

describe("dowIndex", () => {
  it("returns 0 for Monday", () => {
    expect(dowIndex(new Date("2026-06-01T00:00:00Z"))).toBe(0); // lunes
  });
  it("returns 6 for Sunday", () => {
    expect(dowIndex(new Date("2026-06-07T00:00:00Z"))).toBe(6); // domingo
  });
  it("returns 5 for Saturday", () => {
    expect(dowIndex(new Date("2026-06-06T00:00:00Z"))).toBe(5); // sábado
  });
});

describe("fmt", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(fmt(new Date("2026-06-15T12:00:00Z"))).toBe("2026-06-15");
  });
});

describe("isFeriadoIrrenunciable", () => {
  it("returns true for Año Nuevo (1 enero)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 0, 1))).toBe(true);
  });
  it("returns true for Día del Trabajo (1 mayo)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 4, 1))).toBe(true);
  });
  it("returns true for Independencia (18 septiembre)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 8, 18))).toBe(true);
  });
  it("returns true for Las Glorias (19 septiembre)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 8, 19))).toBe(true);
  });
  it("returns true for Navidad (25 diciembre)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 11, 25))).toBe(true);
  });
  it("returns false for a regular workday", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 5, 15))).toBe(false);
  });
  it("returns false for 18 octubre (no es irrenunciable)", () => {
    expect(isFeriadoIrrenunciable(new Date(2026, 9, 18))).toBe(false);
  });
});

describe("shiftDuration", () => {
  it("returns net hours minus 1h colación when >= 6 hours", () => {
    // 09:00–18:30 = 9.5h bruto → 8.5h neto
    expect(shiftDuration({ start: "09:00", end: "18:30" })).toBeCloseTo(8.5);
  });
  it("returns gross hours when < 6 hours (no colación)", () => {
    // 10:00–14:00 = 4h bruto = 4h neto
    expect(shiftDuration({ start: "10:00", end: "14:00" })).toBeCloseTo(4);
  });
  it("returns 0 for same start and end", () => {
    expect(shiftDuration({ start: "09:00", end: "09:00" })).toBe(0);
  });
  it("handles boundary: exactly 6h → descontamos colación", () => {
    // 09:00–15:00 = 6h bruto → 5h neto
    expect(shiftDuration({ start: "09:00", end: "15:00" })).toBeCloseTo(5);
  });
});
