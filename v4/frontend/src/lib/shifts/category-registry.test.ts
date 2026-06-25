import { describe, expect, it } from "vitest";
import {
  SHIFT_CATEGORIES,
  SHIFT_CATEGORY_SET,
  isValidShiftCategory,
  isValidAreaNegocio,
  AREA_NEGOCIO_VALUES,
} from "./category-registry";

describe("SHIFT_CATEGORIES", () => {
  it("contains at least one entry", () => {
    expect(SHIFT_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("all entries are non-empty strings", () => {
    for (const cat of SHIFT_CATEGORIES) {
      expect(typeof cat).toBe("string");
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicates", () => {
    const set = new Set(SHIFT_CATEGORIES);
    expect(set.size).toBe(SHIFT_CATEGORIES.length);
  });
});

describe("SHIFT_CATEGORY_SET", () => {
  it("contains all SHIFT_CATEGORIES entries", () => {
    for (const cat of SHIFT_CATEGORIES) {
      expect(SHIFT_CATEGORY_SET.has(cat)).toBe(true);
    }
  });
});

describe("isValidShiftCategory", () => {
  it("returns true for known categories", () => {
    expect(isValidShiftCategory("ventas_standalone")).toBe(true);
    expect(isValidShiftCategory("optimo_autoplaza")).toBe(true);
    expect(isValidShiftCategory("postventa_standalone")).toBe(true);
  });

  it("returns false for unknown category", () => {
    expect(isValidShiftCategory("categoria_inexistente")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidShiftCategory("")).toBe(false);
  });
});

describe("isValidAreaNegocio", () => {
  it("returns true for 'ventas' and 'postventa'", () => {
    expect(isValidAreaNegocio("ventas")).toBe(true);
    expect(isValidAreaNegocio("postventa")).toBe(true);
  });

  it("returns false for unknown values", () => {
    expect(isValidAreaNegocio("otro")).toBe(false);
    expect(isValidAreaNegocio("Ventas")).toBe(false); // case-sensitive
  });

  it("AREA_NEGOCIO_VALUES contains exactly ventas and postventa", () => {
    expect(AREA_NEGOCIO_VALUES).toContain("ventas");
    expect(AREA_NEGOCIO_VALUES).toContain("postventa");
    expect(AREA_NEGOCIO_VALUES).toHaveLength(2);
  });
});
