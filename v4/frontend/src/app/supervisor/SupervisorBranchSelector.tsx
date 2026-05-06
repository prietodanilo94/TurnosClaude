"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
}

interface GroupInfo {
  id: string;
  nombre: string;
  branches: BranchInfo[];
}

interface Props {
  groups: GroupInfo[];
  ungrouped: BranchInfo[];
  year: number;
  month: number;
}

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function SupervisorBranchSelector({ groups, ungrouped, year, month }: Props) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedUngrouped, setSelectedUngrouped] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function toggleUngrouped(id: string) {
    setSelectedUngrouped((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function goToGroup(groupId: string) {
    router.push(`/supervisor/calendario?groupId=${groupId}&year=${selectedYear}&month=${selectedMonth}`);
  }

  function goToBranch(branchId: string) {
    router.push(`/supervisor/calendario?branchId=${branchId}&year=${selectedYear}&month=${selectedMonth}`);
  }

  async function handleCreateGroup() {
    if (selectedUngrouped.length < 2) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: selectedUngrouped }),
      });
      if (!res.ok) {
        setCreateError((await res.json()).error ?? "Error al crear grupo");
        return;
      }
      router.refresh();
      setSelectedUngrouped([]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector de mes/año */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Período:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          {MONTH_NAMES.slice(1).map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <input
          type="number"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          min={2024}
          max={2100}
          className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Grupos existentes */}
      {groups.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Grupos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 truncate" title={group.nombre}>
                    {group.nombre}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {group.branches.map((b) => (
                      <span key={b.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                        {b.nombre}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => goToGroup(group.id)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Ver calendario
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sucursales sin grupo */}
      {ungrouped.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Sucursales individuales
              {selectedUngrouped.length >= 2 && (
                <span className="ml-2 text-blue-600 font-normal">
                  ({selectedUngrouped.length} seleccionadas)
                </span>
              )}
            </h2>
            {selectedUngrouped.length >= 2 && (
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creando..." : "Agrupar selección"}
              </button>
            )}
          </div>
          {createError && <p className="text-xs text-red-600 mb-2">{createError}</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ungrouped.map((branch) => {
              const checked = selectedUngrouped.includes(branch.id);
              return (
                <div
                  key={branch.id}
                  className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${checked ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUngrouped(branch.id)}
                    className="accent-blue-600 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{branch.nombre}</p>
                    <p className="text-xs text-gray-400">{branch.codigo}</p>
                  </div>
                  <button
                    onClick={() => goToBranch(branch.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
                  >
                    Ver →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {groups.length === 0 && ungrouped.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          No hay sucursales asignadas.
        </div>
      )}
    </div>
  );
}
