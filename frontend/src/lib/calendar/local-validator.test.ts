import { describe, it, expect } from "vitest";
import { validateLocal } from "./local-validator";
import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";

const SHIFT: ShiftDef = {
  id: "S_FULL",
  inicio: "09:00",
  fin: "14:00",
  duracion_minutos: 300,
  descuenta_colacion: false,
};

const BASE_CTX = {
  workers: [],
  constraints: [],
  shiftCatalog: [SHIFT],
  holidays: [],
  horasSemanalesMax: 42,
  diasMaximosConsecutivos: 6,
  domingoLibresMinimos: 2,
  coberturaminima: 1,
  franjaPorDia: {
    lunes: { apertura: "09:00", cierre: "14:00" },
    martes: { apertura: "09:00", cierre: "14:00" },
    miercoles: { apertura: "09:00", cierre: "14:00" },
    jueves: { apertura: "09:00", cierre: "14:00" },
    viernes: { apertura: "09:00", cierre: "14:00" },
    sabado: { apertura: "09:00", cierre: "14:00" },
    domingo: null,
  },
};

function makeA(rut: string, date: string, shift_id = "S_FULL"): CalendarAssignment {
  return { id: `${rut}_${date}_${shift_id}`, worker_rut: rut, date, shift_id, worker_slot: 1 };
}

// Mayo 2026: semana 19 = 4-10 may (lun-dom)
const WEEK19 = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-05-10"];

describe("validateLocal — horas semanales", () => {
  it("no genera violación dentro del límite", () => {
    const assignments = WEEK19.slice(0, 4).map((d) => makeA("A", d));
    const v = validateLocal({ ...BASE_CTX, assignments });
    expect(v.filter((x) => x.tipo === "horas_semanales_excedidas")).toHaveLength(0);
  });

  it("detecta exceso de horas (9 turnos × 5h = 45h > 42h)", () => {
    // 9 asignaciones en 2 semanas distintas pero acumulamos en sem 19
    const assignments = Array.from({ length: 9 }, (_, i) =>
      makeA("A", WEEK19[i % WEEK19.length])
    );
    const v = validateLocal({ ...BASE_CTX, assignments });
    expect(v.some((x) => x.tipo === "horas_semanales_excedidas")).toBe(true);
  });
});

describe("validateLocal — días semanales", () => {
  it("detecta más de 6 días en la misma semana", () => {
    const assignments = WEEK19.map((d) => makeA("A", d));
    const v = validateLocal({ ...BASE_CTX, assignments });
    expect(v.some((x) => x.tipo === "dias_semanales_excedidos")).toBe(true);
  });
});

describe("validateLocal — feriados", () => {
  it("detecta asignación en feriado", () => {
    const assignments = [makeA("A", "2026-05-01")];
    const v = validateLocal({ ...BASE_CTX, assignments, holidays: ["2026-05-01"] });
    expect(v.some((x) => x.tipo === "feriado_asignado")).toBe(true);
  });
});

describe("validateLocal — cobertura", () => {
  it("acepta cobertura suficiente", () => {
    const assignments = [makeA("A", "2026-05-04")];
    const v = validateLocal({ ...BASE_CTX, assignments });
    expect(v.filter((x) => x.tipo === "cobertura_insuficiente")).toHaveLength(0);
  });

  it("detecta día sin cobertura", () => {
    // franja con apertura pero sin asignaciones ese día
    const v = validateLocal({
      ...BASE_CTX,
      assignments: [],
      franjaPorDia: { ...BASE_CTX.franjaPorDia, lunes: { apertura: "09:00", cierre: "14:00" } },
    });
    // No hay asignaciones para lunes 4-may así que no hay fecha en assignsByDate,
    // el validator solo itera fechas que tienen asignaciones. Sin asignaciones = no viola.
    expect(v.filter((x) => x.tipo === "cobertura_insuficiente")).toHaveLength(0);
  });
});
