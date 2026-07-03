"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CambioRow } from "@/lib/rrhh/cambiosData";
import {
  emptyFilters,
  applyFilters,
  availableValuesForColumn,
  sortRows,
  DEFAULT_SORT,
  type TableFilters,
  type CategoricalColumn,
  type SortColumn,
  type SortState,
} from "@/lib/rrhh/tableFilters";
import ExcelColumnFilter from "./ExcelColumnFilter";
import DateColumnFilter from "./DateColumnFilter";

interface Props {
  rows: CambioRow[];
  windowFrom: string;
  windowDays: number;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DayChangeRow({ change }: { change: CambioRow["cambios"][0] }) {
  const { dayLabel, from, to } = change;
  const isAdded = !from && !!to;
  const isRemoved = !!from && !to;
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${isAdded ? "bg-green-400" : isRemoved ? "bg-red-400" : "bg-yellow-400"}`} />
      <span className="w-28 text-gray-500 shrink-0">{dayLabel}</span>
      {from ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono whitespace-nowrap">{from}</span> : <span className="text-gray-400 italic">libre</span>}
      <span className="text-gray-400 text-[10px]">→</span>
      {to ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono whitespace-nowrap">{to}</span> : <span className="text-gray-400 italic">libre</span>}
    </div>
  );
}

const COLUMNS: { id: SortColumn; label: string; categorical?: CategoricalColumn }[] = [
  { id: "area", label: "Área", categorical: "area" },
  { id: "sucursal", label: "Sucursal", categorical: "sucursal" },
  { id: "codigo", label: "Código", categorical: "codigo" },
  { id: "fechaMod", label: "Fecha modificación" },
  { id: "modificadoPor", label: "Modificado por", categorical: "modificadoPor" },
  { id: "trabajador", label: "Trabajador", categorical: "trabajador" },
  { id: "eventos", label: "Eventos", categorical: "eventos" },
  { id: "fechaDescarga", label: "Fecha descarga" },
  { id: "descargadoPor", label: "Descargado por", categorical: "descargadoPor" },
];

export default function ExportarHistorialClient({ rows, windowFrom, windowDays }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<TableFilters>(emptyFilters());
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromInput, setFromInput] = useState(windowFrom);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);

  function toggleSort(col: SortColumn) {
    setSort((prev) => (prev.column === col ? { column: col, dir: prev.dir === "asc" ? "desc" : "asc" } : { column: col, dir: "asc" }));
  }

  function setCategorical(col: CategoricalColumn, next: Set<string> | null) {
    setFilters((prev) => ({ ...prev, categorical: { ...prev.categorical, [col]: next } }));
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const allFilteredSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(r.key));

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        sortedRows.forEach((r) => next.delete(r.key));
        return next;
      }
      const next = new Set(prev);
      sortedRows.forEach((r) => next.add(r.key));
      return next;
    });
  }

  async function downloadKeys(keys: string[]) {
    if (keys.length === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/rrhh/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "turnos_rrhh.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Exportar / Historial</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Cambios de calendario guardados por trabajador, con estado de descarga RRHH.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 flex-wrap text-sm">
        <span className="text-gray-500">Ventana: últimos {windowDays} días</span>
        <span className="text-gray-300">·</span>
        <label className="flex items-center gap-2 text-gray-600">
          Desde
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => router.push(`/admin/exportar-historial?from=${fromInput}`)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
        >
          Ampliar ventana
        </button>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">{rows.length} evento{rows.length !== 1 ? "s" : ""} cargado{rows.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-600">
          {filteredRows.length} de {rows.length} filas · <span className="font-medium text-gray-900">{selected.size}</span> seleccionada{selected.size !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || downloading}
            onClick={() => downloadKeys([...selected])}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Descargar selección
          </button>
          <button
            type="button"
            disabled={filteredRows.length === 0 || downloading}
            onClick={() => downloadKeys(filteredRows.map((r) => r.key))}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Descargar masivo (filtrado)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="w-3.5 h-3.5 rounded border-gray-300"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <span
                      onClick={() => toggleSort(col.id)}
                      title="Click para ordenar"
                      className="cursor-pointer select-none hover:text-gray-700 transition-colors"
                    >
                      {col.label}{" "}
                      <span className={sort.column === col.id ? "text-blue-600" : "text-gray-300"}>
                        {sort.column === col.id ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </span>
                    {col.categorical && (
                      <ExcelColumnFilter
                        values={availableValuesForColumn(rows, filters, col.categorical)}
                        selected={filters.categorical[col.categorical]}
                        onChange={(next) => setCategorical(col.categorical!, next)}
                      />
                    )}
                    {col.id === "fechaMod" && (
                      <DateColumnFilter value={filters.fechaMod} onChange={(next) => setFilters((p) => ({ ...p, fechaMod: next as never }))} />
                    )}
                    {col.id === "fechaDescarga" && (
                      <DateColumnFilter allowEmpty value={filters.fechaDescarga} onChange={(next) => setFilters((p) => ({ ...p, fechaDescarga: next as never }))} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-gray-400">
                    No hay cambios para esos filtros.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <Fragment key={row.key}>
                    <tr className="hover:bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => toggleExpand(row.key)}>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(row.key)}
                          onChange={() => toggleRow(row.key)}
                          className="w-3.5 h-3.5 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 capitalize whitespace-nowrap">{row.area || "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 truncate max-w-[180px]">{row.sucursal || "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{row.codigo || "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(row.fechaMod)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{row.modificadoPor}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{row.trabajador}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 text-center">{row.eventos}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {row.fechaDescarga ? (
                          <span className="text-gray-600">{fmtDateTime(row.fechaDescarga)}</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700">⚠ Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{row.descargadoPor ?? "—"}</td>
                    </tr>
                    {expanded.has(row.key) && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td colSpan={COLUMNS.length + 1} className="px-6 py-3">
                          <div className="space-y-0.5">
                            {row.cambios.map((c, i) => <DayChangeRow key={i} change={c} />)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
