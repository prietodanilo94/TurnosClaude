"use client";

import { useState } from "react";
import Link from "next/link";

interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
  groupId?: string | null;
}

interface GroupInfo {
  id: string;
  nombre: string;
  branches: { id: string; nombre: string; codigo: string }[];
}

interface Props {
  initialGroups: GroupInfo[];
  branches: BranchInfo[];
}

const now = new Date();
const DEFAULT_YEAR = now.getFullYear();
const DEFAULT_MONTH = now.getMonth() + 1;

export default function GruposClient({ initialGroups, branches }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Crear grupo manual
  const [showCreate, setShowCreate] = useState(false);
  const [createSelected, setCreateSelected] = useState<string[]>([]);
  const [createSearch, setCreateSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const ungroupedBranches = branches.filter((b) => !b.groupId);
  const groupedBranchIds = new Set(branches.filter((b) => b.groupId).map((b) => b.id));

  function toggleCreate(id: string) {
    setCreateSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (createSelected.length < 2) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: createSelected }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      const created = await res.json();
      setGroups((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCreateSelected([]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/grupos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editNombre }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      const updated = await res.json();
      setGroups((prev) => prev.map((g) => g.id === id ? updated : g));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDissolve(group: GroupInfo) {
    if (!confirm(`Disolver grupo "${group.nombre}"? Las sucursales quedarán sin grupo.`)) return;
    const res = await fetch(`/api/grupos/${group.id}`, { method: "DELETE" });
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    }
  }

  const filteredUngrouped = ungroupedBranches.filter(
    (b) => !createSearch || b.nombre.toLowerCase().includes(createSearch.toLowerCase()) || b.codigo.includes(createSearch),
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Grupos de sucursales</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {groups.length} grupo{groups.length !== 1 ? "s" : ""} · {branches.length - groupedBranchIds.size} sucursal{branches.length - groupedBranchIds.size !== 1 ? "es" : ""} sin grupo
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateSelected([]); setCreateSearch(""); setError(""); }}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + Nuevo grupo
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      {groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay grupos creados todavía.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nombre", "Sucursales", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === group.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm flex-1"
                          autoFocus
                        />
                        <button onClick={() => handleRename(group.id)} disabled={saving} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
                          Guardar
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{group.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {group.branches.map((b) => (
                        <span key={b.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                          {b.nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link
                      href={`/supervisor/calendario?groupId=${group.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Ver calendario
                    </Link>
                    <button
                      onClick={() => { setEditingId(group.id); setEditNombre(group.nombre); setError(""); }}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      Renombrar
                    </button>
                    <button onClick={() => handleDissolve(group)} className="text-xs text-red-500 hover:text-red-700">
                      Disolver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sucursales sin grupo */}
      {ungroupedBranches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Sucursales sin grupo ({ungroupedBranches.length})</h2>
          <div className="flex flex-wrap gap-2">
            {ungroupedBranches.map((b) => (
              <span key={b.id} className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded">
                {b.nombre} <span className="text-gray-400">({b.codigo})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Modal crear grupo */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Nuevo grupo</h2>
            <p className="text-xs text-gray-500">Selecciona 2 o más sucursales sin grupo. El nombre se genera automáticamente.</p>

            <input
              type="text"
              value={createSearch}
              onChange={(e) => setCreateSearch(e.target.value)}
              placeholder="Buscar sucursal..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredUngrouped.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400">No hay sucursales disponibles.</p>
              ) : (
                filteredUngrouped.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={createSelected.includes(b.id)}
                      onChange={() => toggleCreate(b.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-800">{b.nombre}</span>
                    <span className="text-xs text-gray-400 ml-auto">{b.codigo}</span>
                  </label>
                ))
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || createSelected.length < 2}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creando..." : `Crear grupo (${createSelected.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
