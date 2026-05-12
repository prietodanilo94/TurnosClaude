"use client";

import { useState, useMemo } from "react";
import type { BranchTeamInfo, WorkerWithTeam } from "./page";

interface Props {
  initialWorkers: WorkerWithTeam[];
  branchTeams: BranchTeamInfo[];
}

const EMPTY_FORM = { rut: "", nombre: "", branchTeamId: "" };

export default function TrabajadoresClient({ initialWorkers, branchTeams }: Props) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkerWithTeam | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return workers;
    const q = search.toLowerCase();
    return workers.filter(
      (w) =>
        w.nombre.toLowerCase().includes(q) ||
        w.rut.toLowerCase().includes(q) ||
        w.branchTeam.branch.nombre.toLowerCase().includes(q) ||
        w.branchTeam.branch.codigo.includes(q),
    );
  }, [workers, search]);

  const activeCount = workers.filter((w) => w.activo && !w.esVirtual).length;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(worker: WorkerWithTeam) {
    setEditing(worker);
    setForm({ rut: worker.rut, nombre: worker.nombre, branchTeamId: worker.branchTeamId });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/workers/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: form.nombre, branchTeamId: form.branchTeamId }),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
        const updated = await res.json();
        setWorkers((prev) => prev.map((w) => (w.id === editing.id ? updated : w)));
      } else {
        const res = await fetch("/api/workers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
        const created = await res.json();
        setWorkers((prev) => [...prev, created]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(worker: WorkerWithTeam) {
    const res = await fetch(`/api/workers/${worker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !worker.activo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setWorkers((prev) => prev.map((w) => (w.id === worker.id ? updated : w)));
    }
  }

  async function handleDelete(worker: WorkerWithTeam) {
    if (!confirm(`Eliminar a ${worker.nombre} (${worker.rut})? Esta accion no se puede deshacer.`)) return;
    const res = await fetch(`/api/workers/${worker.id}`, { method: "DELETE" });
    if (res.ok) {
      setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Trabajadores</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeCount} activo{activeCount !== 1 ? "s" : ""} · {workers.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/global"
            className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Exportar todo
          </a>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            + Nuevo trabajador
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, RUT o sucursal..."
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {workers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay trabajadores cargados. Sube una dotacion desde Dotacion.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["RUT", "Nombre", "Sucursal", "Area", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((worker) => (
                <tr key={worker.id} className={`hover:bg-gray-50 ${!worker.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-gray-600 font-mono">{worker.rut}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {worker.nombre}
                    {worker.esVirtual && <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1 rounded">virtual</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {worker.branchTeam.branch.nombre}
                    <span className="ml-1.5 text-xs text-gray-400">{worker.branchTeam.branch.codigo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      worker.branchTeam.areaNegocio === "ventas"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {worker.branchTeam.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActivo(worker)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        worker.activo
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {worker.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(worker)} className="text-blue-600 hover:text-blue-800">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(worker)} className="text-red-500 hover:text-red-700">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                    Sin resultados para &quot;{search}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {editing ? "Editar trabajador" : "Nuevo trabajador"}
            </h2>

            <div className="space-y-3">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">RUT</label>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678-9"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Perez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {editing ? "Trasladar a equipo" : "Equipo"}
                </label>
                <select
                  value={form.branchTeamId}
                  onChange={(e) => setForm((f) => ({ ...f, branchTeamId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {branchTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.branch.nombre} — {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"} ({team.branch.codigo})
                    </option>
                  ))}
                </select>
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
                disabled={saving || !form.nombre || !form.branchTeamId || (!editing && !form.rut)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear trabajador"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
