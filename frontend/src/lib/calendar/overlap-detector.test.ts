import { describe, it, expect } from "vitest";
import { detectOverlaps, overlappingIds } from "./overlap-detector";
import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";

const S1: ShiftDef = { id: "S1", inicio: "09:00", fin: "14:00", duracion_minutos: 300, descuenta_colacion: false };
const S2: ShiftDef = { id: "S2", inicio: "13:00", fin: "18:00", duracion_minutos: 300, descuenta_colacion: false };
const S3: ShiftDef = { id: "S3", inicio: "14:00", fin: "19:00", duracion_minutos: 300, descuenta_colacion: false };

function makeA(rut: string, date: string, shift_id: string): CalendarAssignment {
  return { id: `${rut}_${date}_${shift_id}`, worker_rut: rut, date, shift_id, worker_slot: 1 };
}

describe("detectOverlaps", () => {
  it("no detecta solapamiento entre turnos contiguos (09-14 y 14-19)", () => {
    const assignments = [makeA("A", "2026-05-04", "S1"), makeA("A", "2026-05-04", "S3")];
    expect(detectOverlaps(assignments, [S1, S3])).toHaveLength(0);
  });

  it("detecta solapamiento parcial (09-14 y 13-18)", () => {
    const assignments = [makeA("A", "2026-05-04", "S1"), makeA("A", "2026-05-04", "S2")];
    const pairs = detectOverlaps(assignments, [S1, S2]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].date).toBe("2026-05-04");
  });

  it("no cruza entre diferentes trabajadores", () => {
    const assignments = [makeA("A", "2026-05-04", "S1"), makeA("B", "2026-05-04", "S2")];
    expect(detectOverlaps(assignments, [S1, S2])).toHaveLength(0);
  });

  it("no cruza entre diferentes días", () => {
    const assignments = [makeA("A", "2026-05-04", "S1"), makeA("A", "2026-05-05", "S2")];
    expect(detectOverlaps(assignments, [S1, S2])).toHaveLength(0);
  });
});

describe("overlappingIds", () => {
  it("devuelve IDs de ambos turnos solapados", () => {
    const a1 = makeA("A", "2026-05-04", "S1");
    const a2 = makeA("A", "2026-05-04", "S2");
    const ids = overlappingIds([a1, a2], [S1, S2]);
    expect(ids.has(a1.id)).toBe(true);
    expect(ids.has(a2.id)).toBe(true);
  });

  it("devuelve set vacío sin solapamientos", () => {
    const assignments = [makeA("A", "2026-05-04", "S1"), makeA("A", "2026-05-04", "S3")];
    expect(overlappingIds(assignments, [S1, S3]).size).toBe(0);
  });
});
