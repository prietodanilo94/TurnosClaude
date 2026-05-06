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
  const [selected, setSelected]       = useState<string[]>([]);
  const [confirm, setConfirm]         = useState<BranchInfo[] | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleAssign(branch: BranchInfo) {
    // Incluir esta sucursal en la selección
    const allIds = selected.includes(branch.id) ? selected : [...selected, branch.id];
    const others = allIds.filter((id) => id !== branch.id);

    if (others.length > 0) {
      // Hay otras seleccionadas → confirmar agrupación
      const branchesInfo = ungrouped.filter((b) => allIds.includes(b.id));
      setConfirm(branchesInfo);
    } else {
      // Solo esta → ir directo al calendario
      router.push(`/supervisor/calendario?branchId=${branch.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`);
    }
  }

  async function handleConfirmGroup() {
    if (!confirm) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: confirm.map((b) => b.id) }),
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
              {selected.length > 1 && (
                <span className="ml-2 normal-case text-blue-600 font-normal">
                  {selected.length} seleccionadas — al hacer clic en "Asignación de turnos" se agruparán
                </span>
              )}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ungrouped.map((branch) => {
              const checked = selected.includes(branch.id);
              return (
                <div
                  key={branch.id}
                  className={`bg-white border rounded-lg p-4 space-y-3 transition-colors ${checked ? "border-blue-400 bg-blue-50/40" : "border-gray-200"}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(branch.id)}
                      className="accent-blue-600 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{branch.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{branch.codigo}</p>
                    </div>
                  </label>
                  <button
                    onClick={() => handleAssign(branch)}
                    className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Asignación de turnos
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

      {/* Modal confirmación de agrupación */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Crear grupo</h2>
            <p className="text-sm text-gray-600">
              ¿Deseas agrupar las siguientes sucursales y ver su calendario conjunto?
            </p>
            <ul className="space-y-1">
              {confirm.map((b) => (
                <li key={b.id} className="text-sm font-medium text-gray-800">· {b.nombre}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-400">
              El grupo quedará guardado. Solo un admin puede separarlo.
            </p>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setConfirm(null); setCreateError(""); }}
                disabled={creating}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmGroup}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creando..." : "Sí, crear grupo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
