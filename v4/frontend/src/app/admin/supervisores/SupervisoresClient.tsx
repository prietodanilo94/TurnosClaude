"use client";

import { useState } from "react";
import type { BranchInfo, SupervisorWithBranches } from "./page";

interface Props {
  initialSupervisors: SupervisorWithBranches[];
  branches: BranchInfo[];
}

const EMPTY_FORM = {
  nombre: "",
  email: "",
  password: "",
  branchIds: [] as string[],
  branchSearch: "",
};

export default function SupervisoresClient({ initialSupervisors, branches }: Props) {
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupervisorWithBranches | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readyCount = supervisors.filter((supervisor) => isReadyForProduction(supervisor)).length;
  const missingEmailCount = supervisors.filter((supervisor) => !supervisor.email).length;
  const missingPasswordCount = supervisors.filter((supervisor) => !supervisor.passwordHash).length;
  const missingBranchesCount = supervisors.filter((supervisor) => supervisor.branches.length === 0).length;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(supervisor: SupervisorWithBranches) {
    setEditing(supervisor);
    setForm({
      nombre: supervisor.nombre,
      email: supervisor.email ?? "",
      password: "",
      branchIds: supervisor.branches.map((branch) => branch.branch.id),
      branchSearch: "",
    });
    setError("");
    setShowForm(true);
  }

  function toggleBranch(id: string) {
    setForm((current) => ({
      ...current,
      branchIds: current.branchIds.includes(id)
        ? current.branchIds.filter((value) => value !== id)
        : [...current.branchIds, id],
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

        const res = await fetch(`/api/supervisores/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Error");
          return;
        }
        const updated = await res.json();
        setSupervisors((prev) => prev.map((item) => (item.id === editing.id ? updated : item)));
      } else {
        const res = await fetch("/api/supervisores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Error");
          return;
        }
        const created = await res.json();
        setSupervisors((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(supervisor: SupervisorWithBranches) {
    const res = await fetch(`/api/supervisores/${supervisor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !supervisor.activo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSupervisors((prev) => prev.map((item) => (item.id === supervisor.id ? updated : item)));
    }
  }

  async function handleDelete(supervisor: SupervisorWithBranches) {
    if (!confirm(`Eliminar a ${supervisor.nombre}?`)) return;
    const res = await fetch(`/api/supervisores/${supervisor.id}`, { method: "DELETE" });
    if (res.ok) {
      setSupervisors((prev) => prev.filter((item) => item.id !== supervisor.id));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Supervisores</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {supervisors.length} supervisor{supervisors.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + Nuevo supervisor
        </button>
      </div>

      {supervisors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <SetupMetric label="Listos para operar" value={readyCount} tone="green" />
          <SetupMetric label="Sin email" value={missingEmailCount} tone={missingEmailCount > 0 ? "amber" : "gray"} />
          <SetupMetric label="Sin clave" value={missingPasswordCount} tone={missingPasswordCount > 0 ? "amber" : "gray"} />
          <SetupMetric label="Sin sucursales" value={missingBranchesCount} tone={missingBranchesCount > 0 ? "rose" : "gray"} />
        </div>
      )}

      {supervisors.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay supervisores registrados todavia.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nombre", "Email", "Sucursales", "Preparacion", "Login", "Estado", ""].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {supervisors.map((supervisor) => {
                const setupIssues = getSetupIssues(supervisor);
                return (
                  <tr key={supervisor.id} className={`hover:bg-gray-50 ${setupIssues.length > 0 ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div>{supervisor.nombre}</div>
                      {setupIssues.length > 0 && (
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          Falta: {setupIssues.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {supervisor.email || <span className="text-gray-400 italic">Sin email</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {supervisor.branches.length === 0 ? (
                        <span className="text-gray-400 italic">Sin sucursales</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {supervisor.branches.map((branch) => (
                            <span
                              key={branch.branch.id}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              {branch.branch.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {setupIssues.length === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Listo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Requiere datos
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {supervisor.email && supervisor.passwordHash ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Habilitado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleActivo(supervisor)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          supervisor.activo
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {supervisor.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openEdit(supervisor)} className="text-sm text-blue-600 hover:text-blue-800">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(supervisor)} className="text-sm text-red-500 hover:text-red-700">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {editing ? "Editar supervisor" : "Nuevo supervisor"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((current) => ({ ...current, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Perez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="supervisor@empresa.cl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contrasena {editing && <span className="text-gray-400 font-normal">(opcional)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={editing ? "Dejar vacio para mantener" : "Minimo 6 caracteres"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sucursales asignadas</label>
                <input
                  type="text"
                  value={form.branchSearch}
                  onChange={(e) => setForm((current) => ({ ...current, branchSearch: e.target.value }))}
                  placeholder="Buscar sucursal..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-t-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border-b-0"
                />
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-b-md divide-y divide-gray-100">
                  {branches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">No hay sucursales cargadas.</p>
                  ) : (
                    branches
                      .filter((branch) =>
                        !form.branchSearch ||
                        branch.nombre.toLowerCase().includes(form.branchSearch.toLowerCase()) ||
                        branch.codigo.includes(form.branchSearch),
                      )
                      .map((branch) => (
                        <label
                          key={branch.id}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={form.branchIds.includes(branch.id)}
                            onChange={() => toggleBranch(branch.id)}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-gray-700">{branch.nombre}</span>
                          <span className="text-xs text-gray-400 ml-auto">{branch.codigo}</span>
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
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear supervisor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isReadyForProduction(supervisor: SupervisorWithBranches) {
  return supervisor.activo && !!supervisor.email && !!supervisor.passwordHash && supervisor.branches.length > 0;
}

function getSetupIssues(supervisor: SupervisorWithBranches) {
  const issues: string[] = [];
  if (!supervisor.activo) issues.push("activar");
  if (!supervisor.email) issues.push("email");
  if (!supervisor.passwordHash) issues.push("clave");
  if (supervisor.branches.length === 0) issues.push("sucursal");
  return issues;
}

function SetupMetric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "rose" | "gray" }) {
  const toneClasses = {
    green: "bg-green-50 border-green-100 text-green-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    rose: "bg-rose-50 border-rose-100 text-rose-800",
    gray: "bg-white border-gray-200 text-gray-700",
  };

  return (
    <div className={`border rounded-lg px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}
