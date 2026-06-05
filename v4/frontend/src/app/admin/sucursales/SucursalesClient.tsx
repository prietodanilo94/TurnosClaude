"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  branches: { id: string; nombre: string; supervisors: { id: string; nombre: string }[] }[];
};

export type PatternOption = {
  id: string;
  label: string;
  areaNegocio: string;
};

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

type EstadoKey = "listo" | "vacio" | "none";
type SortKey = "sucursal" | "area" | "categoria" | "vendedores" | "estado";
const ESTADO_RANK: Record<EstadoKey, number> = { listo: 0, vacio: 1, none: 2 };

type DisplayRow = {
  type: "group" | "team";
  key: string;
  sucursal: string;
  area: string; // "grupo" | "ventas" | "postventa"
  categoriaLabel: string;
  vendedores: number;
  estado: EstadoKey;
  group?: GroupData & { supervisorsUnique: { id: string; nombre: string }[] };
  branch?: BranchData;
  team?: TeamData;
};

interface Props {
  branches: BranchData[];
  groups: GroupData[];
  allPatterns: PatternOption[];
  year: number;
  month: number;
  calendarStatus?: Record<string, "listo" | "vacio">;
}

const EMPTY_BRANCH_FORM = { nombre: "", codigo: "", areaNegocio: "ventas" as "ventas" | "postventa", categoria: "" };

export default function SucursalesClient({ branches, groups, allPatterns, year, month, calendarStatus = {} }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_BRANCH_FORM);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreateBranch() {
    if (!form.nombre.trim() || !form.codigo.trim()) {
      setCreateError("Nombre y código son obligatorios");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          codigo: form.codigo.trim(),
          areaNegocio: form.areaNegocio,
          categoria: form.categoria || null,
        }),
      });
      if (!res.ok) {
        setCreateError(((await res.json()) as { error?: string }).error ?? "Error al crear");
        return;
      }
      setShowCreate(false);
      setForm(EMPTY_BRANCH_FORM);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const q = search.toLowerCase();
  const patternLabelMap = new Map(allPatterns.map((p) => [p.id, p.label.toLowerCase()]));
  const groupedBranchIds = new Set(groups.flatMap((g) => g.branches.map((b) => b.id)));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const visibleGroups = groups.filter(
    (g) =>
      !q ||
      g.nombre.toLowerCase().includes(q) ||
      g.branches.some(
        (b) =>
          b.nombre.toLowerCase().includes(q) ||
          (branchById.get(b.id)?.codigo ?? "").toLowerCase().includes(q),
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

  const labelById = new Map(allPatterns.map((p) => [p.id, p.label]));

  // Filas unificadas (grupos + sucursales sueltas) con campos comparables para ordenar
  const groupRows: DisplayRow[] = visibleGroups.map((group) => {
    const teams = group.branches.flatMap((b) => branchById.get(b.id)?.teams ?? []);
    const catTeam = teams.find((t) => t.categoria);
    const area = catTeam?.areaNegocio ?? teams[0]?.areaNegocio ?? "ventas";
    const areaTeams = teams.filter((t) => t.areaNegocio === area);
    const catLabels = [...new Set(
      areaTeams.map((t) => t.categoria).filter((c): c is string => !!c).map((c) => labelById.get(c) ?? c),
    )];
    const vendedores = areaTeams.reduce((s, t) => s + t.workerCount, 0);
    // Solo equipos con vendedores cuentan para el estado (uno vacío no puede tener calendario)
    const statusTeams = areaTeams.filter((t) => t.workerCount > 0);
    const statuses: EstadoKey[] = statusTeams.map((t) => (calendarStatus[t.id] ?? "none") as EstadoKey);
    const estado: EstadoKey =
      statusTeams.length === 0 || statuses.includes("none") ? "none"
      : statuses.includes("vacio") ? "vacio"
      : "listo";
    const supervisorsUnique = [
      ...new Map(group.branches.flatMap((b) => b.supervisors).map((s) => [s.id, s])).values(),
    ];
    return {
      type: "group" as const,
      key: `g-${group.id}`,
      sucursal: group.nombre,
      area: "grupo",
      categoriaLabel: catLabels.join(" · "),
      vendedores,
      estado,
      group: { ...group, supervisorsUnique },
    };
  });

  const teamRows: DisplayRow[] = ungrouped.flatMap((branch) =>
    branch.teams.map((team) => ({
      type: "team" as const,
      key: team.id,
      sucursal: branch.nombre,
      area: team.areaNegocio,
      categoriaLabel: team.categoria ? (labelById.get(team.categoria) ?? team.categoria) : "",
      vendedores: team.workerCount,
      estado: (calendarStatus[team.id] ?? "none") as EstadoKey,
      branch,
      team,
    })),
  );

  let rows: DisplayRow[] = [...groupRows, ...teamRows];
  if (sort) {
    const { key, dir } = sort;
    const val = (r: DisplayRow): string | number => {
      switch (key) {
        case "sucursal": return r.sucursal.toLowerCase();
        case "area": return r.area;
        case "categoria": return r.categoriaLabel ? r.categoriaLabel.toLowerCase() : "￿"; // sin categoría al final
        case "vendedores": return r.vendedores;
        case "estado": return ESTADO_RANK[r.estado];
      }
    };
    rows = [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return cmp !== 0 ? cmp * dir : a.sucursal.localeCompare(b.sucursal);
    });
  }

  function toggleSort(k: SortKey) {
    setSort((prev) => (prev?.key === k ? (prev.dir === 1 ? { key: k, dir: -1 } : null) : { key: k, dir: 1 }));
  }

  function SortTH({ label, k }: { label: string; k: SortKey }) {
    const active = sort?.key === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        title="Click para ordenar"
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={active ? "text-blue-600" : "text-gray-300"}>
            {active ? (sort?.dir === 1 ? "▲" : "▼") : "↕"}
          </span>
        </span>
      </th>
    );
  }

  function EstadoBadge({ estado }: { estado: EstadoKey }) {
    if (estado === "listo") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
          Listo · {MONTHS_ES[month - 1]}
        </span>
      );
    }
    if (estado === "vacio") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
          Sin asignar
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-400 whitespace-nowrap">
        Sin calendario
      </span>
    );
  }

  const tableHead = (
    <thead className="bg-gray-50">
      <tr>
        <SortTH label="Sucursal" k="sucursal" />
        <SortTH label="Área" k="area" />
        <SortTH label="Categoría" k="categoria" />
        <SortTH label="Vendedores" k="vendedores" />
        <SortTH label="Estado" k="estado" />
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sucursal..."
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          + Nueva sucursal
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Nueva sucursal</p>
              <p className="text-xs text-gray-400 mt-0.5">Se crea con un equipo del área seleccionada.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Flota Stellantis"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código</label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="Ej: 1351"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Área de negocio</label>
                  <select
                    value={form.areaNegocio}
                    onChange={(e) => setForm({ ...form, areaNegocio: e.target.value as "ventas" | "postventa", categoria: "" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ventas">Ventas</option>
                    <option value="postventa">Postventa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoría de turno (opcional)</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sin categoría —</option>
                  {allPatterns
                    .filter((p) => p.areaNegocio === form.areaNegocio)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCreateBranch()}
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Creando…" : "Crear sucursal"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          {tableHead}
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row) => {
              if (row.type === "group" && row.group) {
                const group = row.group;
                return (
                  <tr key={row.key} className="hover:bg-blue-50/30 bg-blue-50/10">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{group.nombre}</span>
                        <span className="text-xs text-gray-400">
                          ({group.branches.map((b) => b.nombre).join(" · ")})
                        </span>
                      </div>
                      {group.supervisorsUnique.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[11px] text-gray-400">Supervisor{group.supervisorsUnique.length > 1 ? "es" : ""}:</span>
                          {group.supervisorsUnique.map((s) => (
                            <span key={s.id} className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.nombre}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Grupo
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.categoriaLabel || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.vendedores}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={row.estado} />
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
              }

              const branch = row.branch!;
              const team = row.team!;
              const canView = !!team.categoria && team.workerCount >= 3;
              const categoryOptions = allPatterns
                .filter((p) => p.areaNegocio === team.areaNegocio)
                .map((p) => ({ id: p.id, label: p.label }));

              return (
                <tr key={row.key} className="hover:bg-gray-50">
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
                      team.areaNegocio === "ventas" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
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
                  <td className="px-4 py-3">
                    <EstadoBadge estado={row.estado} />
                  </td>
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
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
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
