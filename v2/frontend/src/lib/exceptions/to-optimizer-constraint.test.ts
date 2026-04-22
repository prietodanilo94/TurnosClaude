import { describe, it, expect } from "vitest";
import { toOptimizerConstraint } from "./to-optimizer-constraint";
import type { WorkerConstraint } from "@/types/models";

function makeConstraint(overrides: Partial<WorkerConstraint>): WorkerConstraint {
  return {
    $id: "c1",
    $createdAt: "2026-04-01T00:00:00.000Z",
    $updatedAt: "2026-04-01T00:00:00.000Z",
    worker_id: "w1",
    creado_por: "admin1",
    tipo: "dia_prohibido",
    ...overrides,
  };
}

describe("toOptimizerConstraint", () => {
  it("dia_prohibido maps valor", () => {
    const result = toOptimizerConstraint(
      makeConstraint({ tipo: "dia_prohibido", valor: "martes" })
    );
    expect(result).toEqual({ tipo: "dia_prohibido", valor: "martes" });
  });

  it("turno_prohibido maps valor", () => {
    const result = toOptimizerConstraint(
      makeConstraint({ tipo: "turno_prohibido", valor: "S_09_19" })
    );
    expect(result).toEqual({ tipo: "turno_prohibido", valor: "S_09_19" });
  });

  it("vacaciones maps fecha_desde y fecha_hasta a desde/hasta", () => {
    const result = toOptimizerConstraint(
      makeConstraint({
        tipo: "vacaciones",
        fecha_desde: "2026-05-10",
        fecha_hasta: "2026-05-20",
      })
    );
    expect(result).toEqual({
      tipo: "vacaciones",
      desde: "2026-05-10",
      hasta: "2026-05-20",
    });
  });

  it("dia_obligatorio_libre almacenado como vacaciones con desde === hasta", () => {
    const result = toOptimizerConstraint(
      makeConstraint({
        tipo: "vacaciones",
        fecha_desde: "2026-06-15",
        fecha_hasta: "2026-06-15",
      })
    );
    expect(result).toEqual({
      tipo: "vacaciones",
      desde: "2026-06-15",
      hasta: "2026-06-15",
    });
  });

  it("dia_prohibido no incluye campos de fecha", () => {
    const result = toOptimizerConstraint(
      makeConstraint({ tipo: "dia_prohibido", valor: "lunes" })
    );
    expect(result.desde).toBeUndefined();
    expect(result.hasta).toBeUndefined();
  });

  it("turno_prohibido no incluye campos de fecha", () => {
    const result = toOptimizerConstraint(
      makeConstraint({ tipo: "turno_prohibido", valor: "S_08_17" })
    );
    expect(result.desde).toBeUndefined();
    expect(result.hasta).toBeUndefined();
  });

  it("vacaciones no incluye valor", () => {
    const result = toOptimizerConstraint(
      makeConstraint({
        tipo: "vacaciones",
        fecha_desde: "2026-07-01",
        fecha_hasta: "2026-07-10",
      })
    );
    expect(result.valor).toBeUndefined();
  });
});
