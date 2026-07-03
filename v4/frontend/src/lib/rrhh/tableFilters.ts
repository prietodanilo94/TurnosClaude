// F10 — logica pura de filtros estilo Excel (checklist en cascada + rango de
// fechas) y ordenamiento para la tabla Exportar/Historial. Sin dependencias
// de React ni de Prisma para poder testear en aislamiento.
import type { CambioRow } from "./cambiosData";

export interface CategoricalFilters {
  area: Set<string> | null;
  sucursal: Set<string> | null;
  codigo: Set<string> | null;
  modificadoPor: Set<string> | null;
  trabajador: Set<string> | null;
  eventos: Set<string> | null;
  descargadoPor: Set<string> | null;
}

export type CategoricalColumn = keyof CategoricalFilters;

export interface DateRangeFilter {
  from: string | null; // yyyy-mm-dd
  to: string | null; // yyyy-mm-dd
}

export interface DownloadDateFilter extends DateRangeFilter {
  onlyEmpty: boolean;
}

export interface TableFilters {
  categorical: CategoricalFilters;
  fechaMod: DateRangeFilter;
  fechaDescarga: DownloadDateFilter;
}

export function emptyFilters(): TableFilters {
  return {
    categorical: {
      area: null,
      sucursal: null,
      codigo: null,
      modificadoPor: null,
      trabajador: null,
      eventos: null,
      descargadoPor: null,
    },
    fechaMod: { from: null, to: null },
    fechaDescarga: { from: null, to: null, onlyEmpty: false },
  };
}

function rowValue(row: CambioRow, column: CategoricalColumn): string {
  switch (column) {
    case "area": return row.area;
    case "sucursal": return row.sucursal;
    case "codigo": return row.codigo;
    case "modificadoPor": return row.modificadoPor;
    case "trabajador": return row.trabajador;
    case "eventos": return String(row.eventos);
    case "descargadoPor": return row.descargadoPor ?? "";
  }
}

function inCategoricalSet(value: string, set: Set<string> | null): boolean {
  return set === null || set.has(value);
}

function inDateRange(iso: string | null, range: DateRangeFilter): boolean {
  if (!iso) return true;
  const day = iso.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export function matchesFilters(row: CambioRow, filters: TableFilters): boolean {
  const cat = filters.categorical;
  if (!inCategoricalSet(row.area, cat.area)) return false;
  if (!inCategoricalSet(row.sucursal, cat.sucursal)) return false;
  if (!inCategoricalSet(row.codigo, cat.codigo)) return false;
  if (!inCategoricalSet(row.modificadoPor, cat.modificadoPor)) return false;
  if (!inCategoricalSet(row.trabajador, cat.trabajador)) return false;
  if (!inCategoricalSet(String(row.eventos), cat.eventos)) return false;
  if (!inCategoricalSet(row.descargadoPor ?? "", cat.descargadoPor)) return false;
  if (!inDateRange(row.fechaMod, filters.fechaMod)) return false;

  if (filters.fechaDescarga.onlyEmpty) {
    if (row.fechaDescarga !== null) return false;
  } else if (!inDateRange(row.fechaDescarga, filters.fechaDescarga)) {
    return false;
  }
  return true;
}

export function applyFilters(rows: CambioRow[], filters: TableFilters): CambioRow[] {
  return rows.filter((r) => matchesFilters(r, filters));
}

// Valores disponibles para el checklist de una columna: se calculan sobre las
// filas que sobreviven a los filtros de las DEMAS columnas (no al propio) —
// asi al filtrar "ventas" en Area, el checklist de Sucursal solo ofrece
// sucursales de ventas, pero el propio checklist de Area no se autoexcluye.
export function availableValuesForColumn(
  rows: CambioRow[],
  filters: TableFilters,
  column: CategoricalColumn,
): string[] {
  const filtersWithoutColumn: TableFilters = {
    ...filters,
    categorical: { ...filters.categorical, [column]: null },
  };
  const survivors = applyFilters(rows, filtersWithoutColumn);
  const values = new Set(survivors.map((r) => rowValue(r, column)));
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

export type SortColumn =
  | "area" | "sucursal" | "codigo" | "fechaMod" | "modificadoPor"
  | "trabajador" | "eventos" | "fechaDescarga" | "descargadoPor";

export interface SortState {
  column: SortColumn;
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: SortState = { column: "fechaMod", dir: "desc" };

export function sortRows(rows: CambioRow[], sort: SortState): CambioRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp: number;
    if (sort.column === "eventos") {
      cmp = a.eventos - b.eventos;
    } else if (sort.column === "fechaMod") {
      cmp = a.fechaMod.localeCompare(b.fechaMod);
    } else if (sort.column === "fechaDescarga") {
      cmp = (a.fechaDescarga ?? "").localeCompare(b.fechaDescarga ?? "");
    } else {
      cmp = String(a[sort.column] ?? "").localeCompare(String(b[sort.column] ?? ""), "es");
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}
