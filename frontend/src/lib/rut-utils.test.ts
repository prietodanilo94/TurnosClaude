import { describe, it, expect } from "vitest";
import { validarRut, normalizarRut } from "./rut-utils";

// RUTs reales válidos usados en los tests:
//   11.222.333-9  →  DV calculado = 9
//   76.354.771-K  →  DV calculado = K
//   12.345.678-5  →  DV calculado = 5

describe("validarRut", () => {
  // ── RUTs válidos ──────────────────────────────────────────────────────────
  it("acepta formato con puntos y guión", () => {
    const r = validarRut("11.222.333-9");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("11222333-9");
  });

  it("acepta formato sin puntos con guión", () => {
    const r = validarRut("11222333-9");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("11222333-9");
  });

  it("acepta formato sin guión (DV pegado)", () => {
    const r = validarRut("112223339");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("11222333-9");
  });

  it("acepta DV K en minúscula y lo normaliza a mayúscula", () => {
    const r = validarRut("76354771-k");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("76354771-K");
  });

  it("acepta espacios alrededor", () => {
    const r = validarRut("  11.222.333-9  ");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("11222333-9");
  });

  it("acepta DV K mayúscula", () => {
    const r = validarRut("76354771-K");
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe("76354771-K");
  });

  // ── RUTs inválidos ────────────────────────────────────────────────────────
  it("detecta DV incorrecto", () => {
    const r = validarRut("11222333-0"); // DV correcto es 9
    expect(r.valido).toBe(false);
  });

  it("rechaza string vacío", () => {
    const r = validarRut("");
    expect(r.valido).toBe(false);
  });

  it("rechaza cuerpo demasiado corto", () => {
    const r = validarRut("123-4");
    expect(r.valido).toBe(false);
  });

  it("rechaza cuerpo no numérico", () => {
    const r = validarRut("ABCDEFG-H");
    expect(r.valido).toBe(false);
  });

  it("rechaza múltiples guiones", () => {
    const r = validarRut("123-456-7");
    expect(r.valido).toBe(false);
  });
});

describe("normalizarRut", () => {
  it("devuelve formato XXXXXXXX-X para RUT válido", () => {
    expect(normalizarRut("11.222.333-9")).toBe("11222333-9");
  });

  it("devuelve string limpio para RUT inválido sin crashes", () => {
    const r = normalizarRut("no-es-un-rut");
    expect(typeof r).toBe("string");
  });
});
