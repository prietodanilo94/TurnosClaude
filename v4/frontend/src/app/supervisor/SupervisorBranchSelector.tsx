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
}

const now = new Date();
const DEFAULT_YEAR  = now.getFullYear();
const DEFAULT_MONTH = now.getMonth() + 1;

export default function SupervisorBranchSelector({ groups, ungrouped }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleCreateGroup() {
    if (selected.length < 2) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: selected }),
      });
      if (!res.ok) {
        setCreateError((await res.json()).error ?? "Error al crear grupo");
        return;
      }
      const group = await res.json();
      router.push(`/supervisor/calendario?groupId=${group.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Grupos existentes */}
      {groups.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Grupos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{group.nombre}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {group.branches.map((b) => (
                      <span key={b.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                        {b.nombre}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/supervisor/calendario?groupId=${group.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Asignación de turnos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sucursales individuales */}
      {ungrouped.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Sucursales
            </h2>
            {selected.length >= 2 && (
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creando..." : `Agrupar ${selected.length} seleccionadas`}
              </button>
            )}
          </div>
          {createError && <p className="text-xs text-red-600 mb-2">{createError}</p>}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {ungrouped.map((branch) => {
              const checked = selected.includes(branch.id);
              return (
                <div
                  key={branch.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${checked ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(branch.id)}
                    className="accent-blue-600 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{branch.nombre}</p>
                    <p className="text-xs text-gray-400">{branch.codigo}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/supervisor/calendario?branchId=${branch.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 shrink-0 font-medium whitespace-nowrap"
                  >
                    Asignación de turnos →
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
