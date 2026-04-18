import { describe, it, expect } from "vitest";
import {
  diaProhibidoSchema, turnoProhibidoSchema, vacacionesSchema,
  hasDuplicateDia, hasDuplicateTurno, hasVacacionesOverlap,
} from "./validation";
import type { WorkerConstraint } from "@/types/models";

function makeConstraint(overrides: Partial<WorkerConstraint>): WorkerConstraint {
  return {
    $id: "c1", $createdAt: "", $updatedAt: "",
    worker_id: "w1", creado_por: "admin",
    tipo: "dia_prohibido", valor: "lunes",
    ...overrides,
  };
}

describe("diaProhibidoSchema", () => {
  it("acepta un día válido", () => {
    expect(diaProhibidoSchema.safeParse({ tipo: "dia_prohibido", valor: "martes" }).success).toBe(true);
  });
  it("rechaza valor no reconocido", () => {
    expect(diaProhibidoSchema.safeParse({ tipo: "dia_prohibido", valor: "lun" }).success).toBe(false);
  });
  it("rechaza sin valor", () => {
    expect(diaProhibidoSchema.safeParse({ tipo: "dia_prohibido" }).success).toBe(false);
  });
});

describe("turnoProhibidoSchema", () => {
  it("acepta shift_id no vacío", () => {
    expect(turnoProhibidoSchema.safeParse({ tipo: "turno_prohibido", valor: "S_09_19" }).success).toBe(true);
  });
  it("rechaza valor vacío", () => {
    expect(turnoProhibidoSchema.safeParse({ tipo: "turno_prohibido", valor: "" }).success).toBe(false);
  });
});

describe("vacacionesSchema", () => {
  it("acepta rango válido", () => {
    expect(vacacionesSchema.safeParse({ tipo: "vacaciones", fecha_desde: "2026-05-10", fecha_hasta: "2026-05-20" }).success).toBe(true);
  });
  it("acepta desde === hasta (1 día)", () => {
    expect(vacacionesSchema.safeParse({ tipo: "vacaciones", fecha_desde: "2026-05-10", fecha_hasta: "2026-05-10" }).success).toBe(true);
  });
  it("rechaza desde > hasta", () => {
    expect(vacacionesSchema.safeParse({ tipo: "vacaciones", fecha_desde: "2026-05-20", fecha_hasta: "2026-05-10" }).success).toBe(false);
  });
  it("rechaza formato inválido", () => {
    expect(vacacionesSchema.safeParse({ tipo: "vacaciones", fecha_desde: "10/05/2026", fecha_hasta: "2026-05-20" }).success).toBe(false);
  });
});

describe("hasDuplicateDia", () => {
  const existing = [makeConstraint({ $id: "c1", tipo: "dia_prohibido", valor: "lunes" })];
  it("detecta duplicado exacto", () => {
    expect(hasDuplicateDia(existing, "lunes")).toBe(true);
  });
  it("no detecta duplicado de otro día", () => {
    expect(hasDuplicateDia(existing, "martes")).toBe(false);
  });
  it("excluye el propio ID al editar", () => {
    expect(hasDuplicateDia(existing, "lunes", "c1")).toBe(false);
  });
});

describe("hasDuplicateTurno", () => {
  const existing = [makeConstraint({ $id: "c2", tipo: "turno_prohibido", valor: "S_09_19" })];
  it("detecta duplicado", () => {
    expect(hasDuplicateTurno(existing, "S_09_19")).toBe(true);
  });
  it("no detecta otro turno", () => {
    expect(hasDuplicateTurno(existing, "S_14_22")).toBe(false);
  });
});

describe("hasVacacionesOverlap", () => {
  const existing = [makeConstraint({ $id: "c3", tipo: "vacaciones", valor: undefined, fecha_desde: "2026-05-10", fecha_hasta: "2026-05-20" })];
  it("detecta solapamiento total", () => {
    expect(hasVacacionesOverlap(existing, "2026-05-01", "2026-05-31")).toBe(true);
  });
  it("detecta solapamiento parcial inicio", () => {
    expect(hasVacacionesOverlap(existing, "2026-05-15", "2026-05-25")).toBe(true);
  });
  it("no detecta rango anterior sin overlap", () => {
    expect(hasVacacionesOverlap(existing, "2026-04-01", "2026-05-09")).toBe(false);
  });
  it("no detecta rango posterior sin overlap", () => {
    expect(hasVacacionesOverlap(existing, "2026-05-21", "2026-05-31")).toBe(false);
  });
  it("excluye el propio ID al editar", () => {
    expect(hasVacacionesOverlap(existing, "2026-05-10", "2026-05-20", "c3")).toBe(false);
  });
});
