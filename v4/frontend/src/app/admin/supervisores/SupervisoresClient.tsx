"use client";

import { useState } from "react";
import Link from "next/link";
import type { BranchInfo, SupervisorWithBranches } from "./page";
import ExcelColumnFilter from "@/app/admin/exportar-historial/ExcelColumnFilter";

type ColId = "nombre" | "email" | "sucursales" | "area" | "preparacion" | "login" | "estado";

const COLUMNS: { id: ColId; label: string }[] = [
  { id: "nombre", label: "Nombre" },
  { id: "email", label: "Email" },
  { id: "sucursales", label: "Sucursales" },
  { id: "area", label: "Area" },
  { id: "preparacion", label: "Preparacion" },
  { id: "login", label: "Login" },
  { id: "estado", label: "Estado" },
];

const AREA_LABEL: Record<"ventas" | "postventa", string> = { ventas: "Ventas", postventa: "Postventa" };

// Valores por columna para orden/filtro estilo Excel (mismo componente que
// Exportar Historial/Masivo). Sucursales y Area son multivaluadas: una fila
// matchea si ALGUN valor esta en el set seleccionado (OR). El supervisor no
// tiene un atributo "area" propio — se deriva de las areas de sus sucursales.
function colValues(s: SupervisorWithBranches, col: ColId): string[] {
  switch (col) {
    case "nombre": return [s.nombre];
    case "email": return [s.email || "(sin email)"];
    case "sucursales": return s.branches.length > 0 ? s.branches.map((b) => b.branch.nombre) : ["(sin sucursales)"];
    case "area": {
      const areas = [...new Set(s.branches.flatMap((b) => b.branch.areas ?? []))];
      return areas.length > 0 ? areas.map((a) => AREA_LABEL[a]) : ["(sin sucursales)"];
    }
    case "preparacion": return [getSetupIssues(s).length === 0 ? "Listo" : "Requiere datos"];
    case "login": return [s.email && s.passwordHash ? "Habilitado" : "Pendiente"];
    case "estado": return [s.activo ? "Activo" : "Inactivo"];
  }
}

function matchesColFilters(
  s: SupervisorWithBranches,
  filters: Record<ColId, Set<string> | null>,
  skip?: ColId,
): boolean {
  return COLUMNS.every(({ id }) => {
    if (id === skip) return true;
    const set = filters[id];
    if (set === null) return true;
    return colValues(s, id).some((v) => set.has(v));
  });
}

interface Props {
  initialSupervisors: SupervisorWithBranches[];
  branches: BranchInfo[];
  year?: number;
  month?: number;
}

const EMPTY_FORM = {
  nombre: "",
  email: "",
  password: "",
  branchIds: [] as string[],
  branchSearch: "",
  isAdmin: false,
  invisible: false,
};

export default function SupervisoresClient({ initialSupervisors, branches, year, month }: Props) {
  const now = new Date();
  const calYear = year ?? now.getFullYear();
  const calMonth = month ?? (now.getMonth() + 1);
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<Record<ColId, Set<string> | null>>({
    nombre: null, email: null, sucursales: null, area: null, preparacion: null, login: null, estado: null,
  });
  const [sort, setSort] = useState<{ col: ColId; dir: 1 | -1 } | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupervisorWithBranches | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const q = search.toLowerCase();
  const bySearch = q
    ? supervisors.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          s.branches.some(
            (sb) =>
              sb.branch.nombre.toLowerCase().includes(q) ||
              sb.branch.codigo.toLowerCase().includes(q),
          ),
      )
    : supervisors;
  const byCols = bySearch.filter((s) => matchesColFilters(s, colFilters));
  const visible = sort
    ? [...byCols].sort((a, b) => sort.dir * colValues(a, sort.col).join(", ").localeCompare(colValues(b, sort.col).join(", "), "es"))
    : byCols;

  function toggleSort(col: ColId) {
    setSort((prev) => (prev?.col === col ? (prev.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));
  }

  function availableValues(col: ColId): string[] {
    const survivors = bySearch.filter((s) => matchesColFilters(s, colFilters, col));
    const values = new Set<string>();
    survivors.forEach((s) => colValues(s, col).forEach((v) => values.add(v)));
    return [...values].sort((a, b) => a.localeCompare(b, "es"));
  }

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
      isAdmin: supervisor.isAdmin ?? false,
      invisible: supervisor.invisible ?? false,
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
          isAdmin: form.isAdmin,
          invisible: form.invisible,
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

  async function handleResetPassword(supervisor: SupervisorWithBranches) {
    if (!confirm(`Resetear clave de ${supervisor.nombre}? El proximo login creara una nueva clave automaticamente.`)) return;
    const res = await fetch(`/api/supervisores/${supervisor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSupervisors((prev) => prev.map((item) => (item.id === supervisor.id ? updated : item)));
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
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar supervisor..."
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            + Nuevo supervisor
          </button>
        </div>
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
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <span
                      onClick={() => toggleSort(col.id)}
                      title="Click para ordenar"
                      className="cursor-pointer select-none hover:text-gray-700 transition-colors"
                    >
                      {col.label}{" "}
                      <span className={sort?.col === col.id ? "text-blue-600" : "text-gray-300"}>
                        {sort?.col === col.id ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                      </span>
                    </span>
                    <ExcelColumnFilter
                      values={availableValues(col.id)}
                      selected={colFilters[col.id]}
                      onChange={(next) => setColFilters((p) => ({ ...p, [col.id]: next }))}
                    />
                  </th>
                ))}
                <th className="px-4 py-3 sticky right-0 bg-gray-50" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {visible.map((supervisor) => {
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
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      {supervisor.branches.length === 0 ? (
                        <span className="text-gray-400 italic">Sin sucursales</span>
                      ) : (
                        (() => {
                          const expanded = expandedBranches.has(supervisor.id);
                          const LIMIT = 4;
                          const shown = expanded ? supervisor.branches : supervisor.branches.slice(0, LIMIT);
                          const hiddenCount = supervisor.branches.length - shown.length;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {shown.map((b) => {
                                const href = b.branch.groupId
                                  ? `/supervisor/calendario?groupId=${b.branch.groupId}&year=${calYear}&month=${calMonth}`
                                  : b.branch.teamId
                                  ? `/admin/sucursales/${b.branch.id}/calendario/${calYear}/${calMonth}?team=${b.branch.teamId}`
                                  : `/admin/sucursales/${b.branch.id}`;
                                return (
                                  <Link
                                    key={b.branch.id}
                                    href={href}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
                                  >
                                    {b.branch.nombre}
                                  </Link>
                                );
                              })}
                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedBranches((prev) => new Set(prev).add(supervisor.id))}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors"
                                >
                                  +{hiddenCount} más
                                </button>
                              )}
                              {expanded && supervisor.branches.length > LIMIT && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedBranches((prev) => {
                                      const next = new Set(prev);
                                      next.delete(supervisor.id);
                                      return next;
                                    })
                                  }
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                  ver menos
                                </button>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(() => {
                        const areas = [...new Set(supervisor.branches.flatMap((b) => b.branch.areas ?? []))];
                        return areas.length === 0 ? (
                          <span className="text-gray-400 italic">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {areas.map((a) => (
                              <span
                                key={a}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  a === "ventas" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
                                }`}
                              >
                                {AREA_LABEL[a]}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
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
                    <td
                      className={`px-4 py-3 text-right space-x-3 sticky right-0 border-l border-gray-100 shadow-[-4px_0_6px_-6px_rgba(0,0,0,0.15)] ${
                        setupIssues.length > 0 ? "bg-amber-50" : "bg-white"
                      }`}
                    >
                      <a
                        href={`/admin/trabajadores?supervisorId=${supervisor.id}`}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Ver equipo
                      </a>
                      {supervisor.branches.length > 0 && (
                        <a
                          href={buildCalendarUrl(supervisor)}
                          className="text-sm text-emerald-600 hover:text-emerald-800"
                        >
                          Ver calendarios
                        </a>
                      )}
                      <button onClick={() => openEdit(supervisor)} className="text-sm text-blue-600 hover:text-blue-800">
                        Editar
                      </button>
                      {supervisor.passwordHash && (
                        <button onClick={() => handleResetPassword(supervisor)} className="text-sm text-amber-600 hover:text-amber-800">
                          Reset clave
                        </button>
                      )}
                      <button onClick={() => handleDelete(supervisor)} className="text-sm text-red-500 hover:text-red-700">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    {search ? <>Sin resultados para &ldquo;{search}&rdquo;</> : "Sin resultados para los filtros aplicados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
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

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={(e) => setForm((current) => ({ ...current, isAdmin: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <span className="text-xs text-gray-700">Admin (acceso total)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.invisible}
                    onChange={(e) => setForm((current) => ({ ...current, invisible: e.target.checked }))}
                    className="accent-gray-500"
                  />
                  <span className="text-xs text-gray-700">Invisible en sucursales</span>
                </label>
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

function buildCalendarUrl(supervisor: SupervisorWithBranches): string {
  return `/admin/supervisores/${supervisor.id}/vista`;
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
