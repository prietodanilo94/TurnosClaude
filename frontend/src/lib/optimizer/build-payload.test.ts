import { describe, it, expect } from "vitest";
import { buildWorkersForPayload } from "./build-payload";
import type { Worker, WorkerConstraint } from "@/types/models";

function makeWorker(overrides: Partial<Worker> & Pick<Worker, "$id" | "rut" | "nombre_completo">): Worker {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    branch_id: "b1",
    activo: true,
    ...overrides,
  };
}

function makeConstraint(overrides: Partial<WorkerConstraint> & Pick<WorkerConstraint, "worker_id" | "tipo">): WorkerConstraint {
  return {
    $id: "c1",
    $createdAt: "2026-04-01T00:00:00.000Z",
    $updatedAt: "2026-04-01T00:00:00.000Z",
    creado_por: "admin1",
    ...overrides,
  };
}

describe("buildWorkersForPayload", () => {
  it("worker con vacaciones 10-20 mayo incluye constraint correcto", () => {
    const workers = [makeWorker({ $id: "w1", rut: "17286931-9", nombre_completo: "ABARZUA VARGAS ANDREA" })];
    const constraints = [
      makeConstraint({ worker_id: "w1", tipo: "vacaciones", fecha_desde: "2026-05-10", fecha_hasta: "2026-05-20" }),
    ];

    const result = buildWorkersForPayload(workers, constraints);

    expect(result).toHaveLength(1);
    expect(result[0].rut).toBe("17286931-9");
    expect(result[0].constraints).toContainEqual({
      tipo: "vacaciones",
      desde: "2026-05-10",
      hasta: "2026-05-20",
    });
  });

  it("worker sin excepciones tiene constraints vacío", () => {
    const workers = [makeWorker({ $id: "w2", rut: "12345678-9", nombre_completo: "GONZALEZ PEREZ CARLOS" })];
    const result = buildWorkersForPayload(workers, []);
    expect(result[0].constraints).toEqual([]);
  });

  it("solo incluye constraints del worker correcto", () => {
    const workers = [
      makeWorker({ $id: "w1", rut: "11111111-1", nombre_completo: "WORKER A" }),
      makeWorker({ $id: "w2", rut: "22222222-2", nombre_completo: "WORKER B" }),
    ];
    const constraints = [
      makeConstraint({ $id: "c1", worker_id: "w1", tipo: "dia_prohibido", valor: "martes" }),
      makeConstraint({ $id: "c2", worker_id: "w2", tipo: "turno_prohibido", valor: "S_09_19" }),
    ];

    const result = buildWorkersForPayload(workers, constraints);

    expect(result[0].constraints).toEqual([{ tipo: "dia_prohibido", valor: "martes" }]);
    expect(result[1].constraints).toEqual([{ tipo: "turno_prohibido", valor: "S_09_19" }]);
  });

  it("worker puede tener múltiples constraints de distintos tipos", () => {
    const workers = [makeWorker({ $id: "w1", rut: "17286931-9", nombre_completo: "ANDREA" })];
    const constraints = [
      makeConstraint({ $id: "c1", worker_id: "w1", tipo: "dia_prohibido", valor: "martes" }),
      makeConstraint({ $id: "c2", worker_id: "w1", tipo: "vacaciones", fecha_desde: "2026-05-10", fecha_hasta: "2026-05-20" }),
    ];

    const result = buildWorkersForPayload(workers, constraints);

    expect(result[0].constraints).toHaveLength(2);
    expect(result[0].constraints).toContainEqual({ tipo: "dia_prohibido", valor: "martes" });
    expect(result[0].constraints).toContainEqual({ tipo: "vacaciones", desde: "2026-05-10", hasta: "2026-05-20" });
  });

  it("rut y nombre se mapean correctamente", () => {
    const workers = [makeWorker({ $id: "w1", rut: "17286931-9", nombre_completo: "ABARZUA VARGAS ANDREA" })];
    const result = buildWorkersForPayload(workers, []);
    expect(result[0].rut).toBe("17286931-9");
    expect(result[0].nombre).toBe("ABARZUA VARGAS ANDREA");
  });
});
