"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const MONTHS_ES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface AssignedWorker {
  id: string;
  nombre: string;
  rut: string;
}

interface Row {
  teamId: string;
  branchNombre: string;
  branchCodigo: string;
  areaNegocio: string;
  totalWorkers: number;
  assignedCount: number;
  assignedWorkers: AssignedWorker[];
}

interface Props {
  year: number;
  month: number;
  rows: Row[];
  totalAssigned: number;
}

export default function ExportarClient({ year, month, rows }: Props) {
  const router = useRouter();
  const [excludedTeams, setExcludedTeams] = useState<Set<string>>(new Set());
  const [excludedWorkers, setExcludedWorkers] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-");
    router.push(`/admin/exportar?year=${y}&month=${m}`);
  }

  function toggleExpand(teamId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  }

  function excludeTeam(teamId: string) {
    setExcludedTeams((prev) => new Set([...prev, teamId]));
    setExpanded((prev) => { const n = new Set(prev); n.delete(teamId); return n; });
  }

  function excludeWorker(workerId: string) {
    setExcludedWorkers((prev) => new Set([...prev, workerId]));
  }

  function handleExport() {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (excludedTeams.size > 0) params.set("excludeTeams", [...excludedTeams].join(","));
    if (excludedWorkers.size > 0) params.set("excludeWorkers", [...excludedWorkers].join(","));
    window.open(`/api/calendars/export-masivo?${params}`, "_blank");
  }

  const visibleRows = rows.filter((r) => !excludedTeams.has(r.teamId));
  const totalRows = visibleRows.reduce((sum, r) => {
    const skipped = r.assignedWorkers.filter((w) => excludedWorkers.has(w.id)).length;
    return sum + r.assignedCount - skipped;
  }, 0);

  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    options.push({ value: `${y}-${m}`, label: `${MONTHS_ES[m]} ${y}` });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Exportación masiva RRHH</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Descarga un Excel con RUT y horarios de todos los equipos con calendario guardado.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Mes:</label>
        <select
          value={`${year}-${month}`}
          onChange={handleMonthChange}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay calendarios guardados para {MONTHS_ES[month]} {year}.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="w-8 px-2 py-2.5" />
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Sucursal</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Código</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Área</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Asignados</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const isExcluded = excludedTeams.has(row.teamId);
                const isExpanded = expanded.has(row.teamId);
                const visibleWorkers = row.assignedWorkers.filter((w) => !excludedWorkers.has(w.id));
                const skipped = row.assignedWorkers.length - visibleWorkers.length;
                const effectiveCount = row.assignedCount - skipped;

                if (isExcluded) return null;

                return (
                  <React.Fragment key={row.teamId}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-center">
                        {row.assignedWorkers.length > 0 && (
                          <button
                            onClick={() => toggleExpand(row.teamId)}
                            className="text-gray-400 hover:text-gray-700 text-xs leading-none"
                            title={isExpanded ? "Colapsar" : "Ver trabajadores"}
                          >
                            {isExpanded ? "▾" : "▸"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-900">{row.branchNombre}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{row.branchCodigo}</td>
                      <td className="px-4 py-2 text-gray-500 capitalize">{row.areaNegocio}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={effectiveCount < row.totalWorkers ? "text-amber-600 font-medium" : "text-gray-900"}>
                          {effectiveCount}
                        </span>
                        <span className="text-gray-400 text-xs"> / {row.totalWorkers}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => excludeTeam(row.teamId)}
                          className="text-gray-300 hover:text-red-500 text-base leading-none"
                          title="Excluir equipo"
                        >
                          ×
                        </button>
                      </td>
                    </tr>

                    {isExpanded && visibleWorkers.map((worker) => (
                      <tr key={worker.id} className="bg-blue-50/30">
                        <td className="px-2 py-1" />
                        <td colSpan={3} className="px-4 py-1.5 pl-10 text-xs text-gray-700">
                          {worker.nombre}
                          <span className="ml-2 text-gray-400 font-mono">{worker.rut.split("-")[0]}</span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-xs text-gray-400" />
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => excludeWorker(worker.id)}
                            className="text-gray-300 hover:text-red-500 text-base leading-none"
                            title="Excluir trabajador"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-gray-600">
                  {visibleRows.length} equipo{visibleRows.length !== 1 ? "s" : ""} con calendario
                  {excludedTeams.size > 0 && (
                    <span className="text-gray-400 ml-1">({excludedTeams.size} excluido{excludedTeams.size !== 1 ? "s" : ""})</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-900">
                  {totalRows} filas
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
        >
          Descargar Excel — {MONTHS_ES[month]} {year} ({totalRows} filas)
        </button>
      )}
    </div>
  );
}
