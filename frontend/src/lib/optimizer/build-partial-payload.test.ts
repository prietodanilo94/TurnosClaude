import { describe, it, expect } from "vitest";
import { buildPartialPayload } from "./build-partial-payload";
import type { OptimizePayload } from "./build-payload";
import type { CalendarAssignment } from "@/types/optimizer";
import type { PartialRecalculateParams } from "@/features/calendar/PartialRecalculateDialog";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const basePayload: OptimizePayload = {
  branch: { id: "b1", codigo_area: "1200", nombre: "Sucursal Test", tipo_franja: "standalone" },
  month: { year: 2026, month: 5 },
  workers: [
    { rut: "11111111-1", nombre: "WORKER A", constraints: [] },
    { rut: "22222222-2", nombre: "WORKER B", constraints: [] },
    { rut: "33333333-3", nombre: "WORKER C", constraints: [] },
  ],
  holidays: [],
  shift_catalog: [
    { id: "S_09_19", inicio: "09:00", fin: "19:00", duracion_minutos: 540, descuenta_colacion: true },
  ],
  franja_por_dia: {},
};

const assignments: CalendarAssignment[] = [
  { id: "11111111-1_2026-05-01_S_09_19", worker_rut: "11111111-1", worker_slot: 1, date: "2026-05-01", shift_id: "S_09_19" },
  { id: "22222222-2_2026-05-10_S_09_19", worker_rut: "22222222-2", worker_slot: 2, date: "2026-05-10", shift_id: "S_09_19" },
  { id: "33333333-3_2026-05-20_S_09_19", worker_rut: "33333333-3", worker_slot: 3, date: "2026-05-20", shift_id: "S_09_19" },
  { id: "11111111-1_2026-05-28_S_09_19", worker_rut: "11111111-1", worker_slot: 1, date: "2026-05-28", shift_id: "S_09_19" },
];

const params: PartialRecalculateParams = {
  desde: "2026-05-15",
  hasta: "2026-05-25",
  excludedRuts: [],
  modo: "ilp",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildPartialPayload", () => {
  it("assignments_fijas contiene solo las fuera del rango", () => {
    const result = buildPartialPayload(basePayload, assignments, params);

    // 2026-05-01 y 2026-05-10 están antes del rango; 2026-05-28 después
    expect(result.assignments_fijas).toHaveLength(3);
    const dates = result.assignments_fijas.map((a) => a.date);
    expect(dates).toContain("2026-05-01");
    expect(dates).toContain("2026-05-10");
    expect(dates).toContain("2026-05-28");
    // 2026-05-20 está dentro del rango → no es fija
    expect(dates).not.toContain("2026-05-20");
  });

  it("workers_excluidos se propagan correctamente", () => {
    const p = { ...params, excludedRuts: ["22222222-2"] };
    const result = buildPartialPayload(basePayload, assignments, p);

    expect(result.workers_excluidos).toEqual(["22222222-2"]);
    expect(result.workers.map((w) => w.rut)).not.toContain("22222222-2");
    expect(result.workers).toHaveLength(2);
  });

  it("sin excluidos, todos los workers se mantienen", () => {
    const result = buildPartialPayload(basePayload, assignments, params);
    expect(result.workers).toHaveLength(3);
    expect(result.workers_excluidos).toEqual([]);
  });

  it("partial_range se asigna correctamente", () => {
    const result = buildPartialPayload(basePayload, assignments, params);
    expect(result.partial_range).toEqual({ desde: "2026-05-15", hasta: "2026-05-25" });
  });

  it("modo y num_propuestas=1 en parametros", () => {
    const result = buildPartialPayload(basePayload, assignments, { ...params, modo: "greedy" });
    expect(result.parametros).toMatchObject({ modo: "greedy", num_propuestas: 1 });
  });

  it("assignments_fijas tienen el shape correcto (sin id)", () => {
    const result = buildPartialPayload(basePayload, assignments, params);
    for (const a of result.assignments_fijas) {
      expect(a).toHaveProperty("worker_rut");
      expect(a).toHaveProperty("date");
      expect(a).toHaveProperty("shift_id");
      expect(a).not.toHaveProperty("id");
      expect(a).not.toHaveProperty("worker_slot");
    }
  });

  it("rango completo → sin assignments_fijas", () => {
    const fullRange = { ...params, desde: "2026-05-01", hasta: "2026-05-31" };
    const result = buildPartialPayload(basePayload, assignments, fullRange);
    expect(result.assignments_fijas).toHaveLength(0);
  });
});
