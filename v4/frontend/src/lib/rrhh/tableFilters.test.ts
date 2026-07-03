import { describe, expect, it } from "vitest";
import { emptyFilters, applyFilters, availableValuesForColumn, sortRows } from "./tableFilters";
import type { CambioRow } from "./cambiosData";

function row(overrides: Partial<CambioRow> & { key: string }): CambioRow {
  return {
    auditLogId: "log-1",
    area: "ventas",
    sucursal: "Peugeot Mall Plaza Sur",
    codigo: "101",
    fechaMod: "2026-07-01T10:00:00.000Z",
    modificadoPor: "emanuel@pompeyo.cl",
    workerId: "w1",
    trabajador: "Ana",
    eventos: 1,
    cambios: [],
    fechaDescarga: null,
    descargadoPor: null,
    ...overrides,
  };
}

const ROWS: CambioRow[] = [
  row({ key: "1", area: "ventas", sucursal: "Peugeot Mall Plaza Sur", trabajador: "Ana" }),
  row({ key: "2", area: "ventas", sucursal: "Citroën Mall Plaza Sur", trabajador: "Beto" }),
  row({ key: "3", area: "postventa", sucursal: "Geely Mall Plaza Oeste", trabajador: "Caro", fechaDescarga: "2026-07-05T00:00:00.000Z", descargadoPor: "admin@pompeyo.cl" }),
];

describe("applyFilters", () => {
  it("returns all rows when no filters are set", () => {
    expect(applyFilters(ROWS, emptyFilters())).toHaveLength(3);
  });

  it("filters by a categorical column", () => {
    const filters = emptyFilters();
    filters.categorical.area = new Set(["ventas"]);
    expect(applyFilters(ROWS, filters).map((r) => r.key)).toEqual(["1", "2"]);
  });

  it("filters fechaDescarga onlyEmpty", () => {
    const filters = emptyFilters();
    filters.fechaDescarga.onlyEmpty = true;
    expect(applyFilters(ROWS, filters).map((r) => r.key)).toEqual(["1", "2"]);
  });

  it("filters fechaMod by range", () => {
    const filters = emptyFilters();
    filters.fechaMod = { from: "2026-07-02", to: null };
    expect(applyFilters(ROWS, filters)).toHaveLength(0);
  });
});

describe("availableValuesForColumn (cascada)", () => {
  it("computes sucursal values only from rows surviving the area filter", () => {
    const filters = emptyFilters();
    filters.categorical.area = new Set(["ventas"]);
    const sucursales = availableValuesForColumn(ROWS, filters, "sucursal");
    expect(sucursales.sort()).toEqual(["Citroën Mall Plaza Sur", "Peugeot Mall Plaza Sur"].sort());
  });

  it("does not self-exclude: area checklist still shows all area values even when area filter is active", () => {
    const filters = emptyFilters();
    filters.categorical.area = new Set(["ventas"]);
    const areas = availableValuesForColumn(ROWS, filters, "area");
    expect(areas.sort()).toEqual(["postventa", "ventas"]);
  });
});

describe("sortRows", () => {
  it("sorts by fechaMod desc by default semantics", () => {
    const sorted = sortRows(ROWS, { column: "fechaMod", dir: "desc" });
    expect(sorted.every((_, i, arr) => i === 0 || arr[i - 1].fechaMod >= arr[i].fechaMod)).toBe(true);
  });

  it("sorts by eventos numerically, not lexicographically", () => {
    const rows = [row({ key: "a", eventos: 2 }), row({ key: "b", eventos: 10 }), row({ key: "c", eventos: 1 })];
    const sorted = sortRows(rows, { column: "eventos", dir: "asc" });
    expect(sorted.map((r) => r.eventos)).toEqual([1, 2, 10]);
  });
});
