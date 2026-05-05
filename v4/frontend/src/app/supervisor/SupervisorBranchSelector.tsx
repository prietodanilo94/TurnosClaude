"use client";

import { useMemo, useState } from "react";

interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
}

export default function SupervisorBranchSelector({
  branches,
  year,
  month,
}: {
  branches: BranchInfo[];
  year: number;
  month: number;
}) {
  const [selected, setSelected] = useState<string[]>(branches.map((branch) => branch.id));
  const [search, setSearch] = useState("");

  const visibleBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          !search ||
          branch.nombre.toLowerCase().includes(search.toLowerCase()) ||
          branch.codigo.includes(search),
      ),
    [branches, search],
  );

  function toggleBranch(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === branches.length ? [] : branches.map((branch) => branch.id)));
  }

  return (
    <form action="/supervisor/calendario" className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis sucursales</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Selecciona una o varias sucursales para ver el calendario combinado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {selected.length === branches.length ? "Quitar todas" : "Seleccionar todas"}
          </button>
          <button
            type="submit"
            disabled={selected.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Ver calendario combinado
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sucursal..."
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="number"
          name="month"
          min={1}
          max={12}
          defaultValue={month}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="number"
          name="year"
          min={2024}
          max={2100}
          defaultValue={year}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
        {visibleBranches.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No hay sucursales para ese filtro.</p>
        ) : (
          visibleBranches.map((branch) => {
            const checked = selected.includes(branch.id);
            return (
              <label key={branch.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="branchId"
                  value={branch.id}
                  checked={checked}
                  onChange={() => toggleBranch(branch.id)}
                  className="accent-blue-600"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{branch.nombre}</div>
                  <div className="text-xs text-gray-400">{branch.codigo}</div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </form>
  );
}
