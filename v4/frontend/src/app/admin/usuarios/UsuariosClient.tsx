"use client";

import { useState } from "react";
import type { BranchInfo, UserWithBranches } from "./page";

interface Props {
  initialUsers: UserWithBranches[];
  branches: BranchInfo[];
}

const EMPTY_FORM = { nombre: "", email: "", password: "", branchIds: [] as string[], branchSearch: "" };

export default function UsuariosClient({ initialUsers, branches }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserWithBranches | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(u: UserWithBranches) {
    setEditing(u);
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: "",
      branchIds: u.branches.map((b) => b.branch.id),
      branchSearch: "",
    });
    setError("");
    setShowForm(true);
  }

  function toggleBranch(id: string) {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((b) => b !== id)
        : [...f.branchIds, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          nombre: form.nombre,
          email: form.email,
          branchIds: form.branchIds,
        };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/usuarios/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? updated : u)));
      } else {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
        const created = await res.json();
        setUsers((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(u: UserWithBranches) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    }
  }

  async function handleDelete(u: UserWithBranches) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Jefes de Sucursal</h1>
          <p className="text-xs text-gray-400 mt-0.5">{users.length} usuario{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + Nuevo jefe
        </button>
      </div>

      {/* Tabla */}
      {users.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay jefes de sucursal registrados.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nombre", "Email", "Sucursales", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {u.branches.length === 0 ? (
                      <span className="text-gray-400 italic">Sin sucursales</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.branches.map((b) => (
                          <span key={b.branch.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                            {b.branch.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        u.activo
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {editing ? "Editar jefe de sucursal" : "Nuevo jefe de sucursal"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="juan@empresa.cl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contraseña {editing && <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={editing ? "••••••••" : "Mínimo 6 caracteres"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sucursales asignadas</label>
                <input
                  type="text"
                  value={form.branchSearch}
                  onChange={(e) => setForm((f) => ({ ...f, branchSearch: e.target.value }))}
                  placeholder="Buscar sucursal…"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-t-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border-b-0"
                />
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-b-md divide-y divide-gray-100">
                  {branches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">No hay sucursales cargadas.</p>
                  ) : (
                    branches
                      .filter((b) =>
                        !form.branchSearch ||
                        b.nombre.toLowerCase().includes(form.branchSearch.toLowerCase()) ||
                        b.codigo.includes(form.branchSearch)
                      )
                      .map((b) => (
                        <label key={b.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={form.branchIds.includes(b.id)}
                            onChange={() => toggleBranch(b.id)}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-gray-700">{b.nombre}</span>
                          <span className="text-xs text-gray-400 ml-auto">{b.codigo}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear jefe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
