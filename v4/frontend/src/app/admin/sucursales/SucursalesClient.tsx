"use client";

import { useState } from "react";
import Link from "next/link";
import CategorySelector from "./[id]/CategorySelector";

export type TeamData = {
  id: string;
  areaNegocio: string;
  categoria: string | null;
  workerCount: number;
};

export type BranchData = {
  id: string;
  nombre: string;
  codigo: string;
  supervisors: { id: string; nombre: string }[];
  teams: TeamData[];
};

export type GroupData = {
  id: string;
  nombre: string;
  branches: { id: string; nombre: string; codigo: string; supervisors: { id: string; nombre: string }[] }[];
};

export type PatternOption = {
  id: string;
  label: string;
  areaNegocio: string;
};

interface Props {
  branches: BranchData[];
  groups: GroupData[];
  allPatterns: PatternOption[];
  year: number;
  month: number;
}

export default function SucursalesClient({ branches, groups, allPatterns, year, month }: Props) {
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();
  const patternLabelMap = new Map(allPatterns.map((p) => [p.id, p.label.toLowerCase()]));
  const groupedBranchIds = new Set(groups.flatMap((g) => g.branches.map((b) => b.id)));

  const visibleGroups = groups.filter(
    (g) =>
      !q ||
      g.nombre.toLowerCase().includes(q) ||
      g.branches.some(
        (b) => b.nombre.toLowerCase().includes(q) || b.codigo.toLowerCase().includes(q),
      ),
  );

  const ungrouped = branches
    .filter((b) => !groupedBranchIds.has(b.id))
    .filter((b) => {
      if (!q) return true;
      if (b.nombre.toLowerCase().includes(q) || b.codigo.toLowerCase().includes(q)) return true;
      return b.teams.some((t) => {
        if (!t.categoria) return false;
        const label = patternLabelMap.get(t.categoria) ?? t.categoria.toLowerCase();
        return label.includes(q) || t.categoria.toLowerCase().includes(q);
      });
    });

  const tableHead = (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedores</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar sucursal..."
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          {tableHead}
          <tbody className="bg-white divide-y divide-gray-100">
            {visibleGroups.map((group) => {
              const groupSupervisors = [
                ...new Map(
                  group.branches.flatMap((b) => b.supervisors).map((s) => [s.id, s])
                ).values(),
              ];
              return (
              <tr key={group.id} className="hover:bg-blue-50/30 bg-blue-50/10">
                <td className="px-4 py-3 text-sm text-gray-900" colSpan={4}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{group.nombre}</span>
                    <span className="text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Grupo</span>
                    <span className="text-xs text-gray-400">
                      ({group.branches.map((b) => b.nombre).join(" · ")})
                    </span>
                  </div>
                  {groupSupervisors.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[11px] text-gray-400">Supervisor{groupSupervisors.length > 1 ? "es" : ""}:</span>
                      {groupSupervisors.map((s) => (
                        <span key={s.id} className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.nombre}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href="/admin/grupos" className="text-xs text-gray-400 hover:text-gray-600">
                      Gestionar
                    </Link>
                    <Link
                      href={`/supervisor/calendario?groupId=${group.id}&year=${year}&month=${month}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Asignación de Turnos →
                    </Link>
                  </div>
                </td>
              </tr>
              );
            })}

            {ungrouped.flatMap((branch) =>
              branch.teams.map((team) => {
                const canView = !!team.categoria && team.workerCount >= 3;
                const categoryOptions = allPatterns
                  .filter((p) => p.areaNegocio === team.areaNegocio)
                  .map((p) => ({ id: p.id, label: p.label }));

                return (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="font-medium">{branch.nombre}</span>
                      <span className="ml-2 text-xs text-gray-400">{branch.codigo}</span>
                      {branch.supervisors.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-gray-400">Supervisor{branch.supervisors.length > 1 ? "es" : ""}:</span>
                          {branch.supervisors.map((s) => (
                            <span key={s.id} className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.nombre}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        team.areaNegocio === "ventas" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <CategorySelector
                        teamId={team.id}
                        current={team.categoria}
                        options={categoryOptions}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{team.workerCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/admin/sucursales/${branch.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                          Accesos
                        </Link>
                        {canView ? (
                          <Link
                            href={`/admin/sucursales/${branch.id}/calendario/${year}/${month}?team=${team.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Asignación de Turnos →
                          </Link>
                        ) : (
                          <span
                            className="text-sm text-gray-300 cursor-not-allowed"
                            title={!team.categoria ? "Selecciona una categoría primero" : "Se requieren al menos 3 vendedores"}
                          >
                            Asignación de Turnos
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }),
            )}

            {visibleGroups.length === 0 && ungrouped.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin resultados para &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
