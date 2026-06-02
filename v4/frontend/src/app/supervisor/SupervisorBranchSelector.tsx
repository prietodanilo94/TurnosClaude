"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface BranchInfo {
  id: string;
  nombre: string;
  codigo: string;
  supervisors: { id: string; nombre: string }[];
  status: {
    teamCount: number;
    activeWorkerCount: number;
    missingCategory: boolean;
    hasCalendar: boolean;
    issueCount: number;
  };
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
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export default function SupervisorBranchSelector({ groups, ungrouped }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState("");
  const [managingGroup, setManagingGroup] = useState<GroupInfo | null>(null);
  const [dissolving, setDissolving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleDissolve(group: GroupInfo) {
    setDissolving(true);
    try {
      const res = await fetch(`/api/grupos/${group.id}`, { method: "DELETE" });
      if (res.ok) {
        setManagingGroup(null);
        router.refresh();
      }
    } finally {
      setDissolving(false);
    }
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
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {groups.map((group) => {
              const groupSupervisors = [
                ...new Map(
                  group.branches.flatMap((b) => b.supervisors).map((s) => [s.id, s])
                ).values(),
              ];
              return (
              <div key={group.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{group.nombre}</p>
                    <GroupStatusBadge branches={group.branches} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {group.branches.map((b) => (
                      <span key={b.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                        {b.nombre}
                      </span>
                    ))}
                  </div>
                  {groupSupervisors.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[11px] text-gray-400">Supervisor{groupSupervisors.length > 1 ? "es" : ""}:</span>
                      {groupSupervisors.map((s) => (
                        <span key={s.id} className="text-[11px] text-gray-500">{s.nombre}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setManagingGroup(group)}
                    className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                  >
                    Gestionar
                  </button>
                  <button
                    onClick={() => router.push(`/supervisor/calendario?groupId=${group.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  >
                    {getGroupActionLabel(group.branches)} →
                  </button>
                </div>
              </div>
              );
            })}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{branch.nombre}</p>
                      <BranchStatusBadge branch={branch} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {branch.codigo} - {branch.status.activeWorkerCount} vendedor{branch.status.activeWorkerCount !== 1 ? "es" : ""}
                    </p>
                    {branch.supervisors.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">Supervisor{branch.supervisors.length > 1 ? "es" : ""}:</span>
                        {branch.supervisors.map((s) => (
                          <span key={s.id} className="text-[11px] text-gray-500">{s.nombre}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/supervisor/calendario?branchId=${branch.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 shrink-0 font-medium whitespace-nowrap"
                  >
                    {getBranchActionLabel(branch)} →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal gestionar grupo */}
      {managingGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{managingGroup.nombre}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{managingGroup.branches.length} sucursales</p>
              </div>
              <button onClick={() => setManagingGroup(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {managingGroup.branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-gray-800">{b.nombre}</span>
                  <span className="text-xs text-gray-400">{b.codigo}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => handleDissolve(managingGroup)}
                disabled={dissolving}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {dissolving ? "Disolviendo..." : "Disolver grupo"}
              </button>
              <button
                onClick={() => {
                  setManagingGroup(null);
                  router.push(`/supervisor/calendario?groupId=${managingGroup.id}&year=${DEFAULT_YEAR}&month=${DEFAULT_MONTH}`);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Ver calendario →
              </button>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 && ungrouped.length === 0 && (
        <div className="bg-white border border-amber-200 rounded-lg p-8 text-center">
          <h2 className="text-base font-semibold text-gray-900">No tienes sucursales asignadas todavia</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Para operar calendarios, un administrador debe asignarte al menos una sucursal y confirmar que tenga equipo, categoria y vendedores activos.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-4 inline-block">
            Pide a RRHH o al administrador revisar tu usuario en Admin &gt; Supervisores.
          </p>
        </div>
      )}
    </div>
  );
}

function BranchStatusBadge({ branch }: { branch: BranchInfo }) {
  if (branch.status.teamCount === 0) {
    return <StatusPill tone="rose" label="Sin equipo" />;
  }

  if (branch.status.missingCategory) {
    return <StatusPill tone="amber" label="Falta categoria" />;
  }

  if (branch.status.activeWorkerCount === 0) {
    return <StatusPill tone="rose" label="Sin vendedores" />;
  }

  if (!branch.status.hasCalendar) {
    return <StatusPill tone="blue" label="No generado" />;
  }

  return <StatusPill tone="green" label={`Guardado · ${MONTHS_ES[DEFAULT_MONTH - 1]}`} />;
}

function GroupStatusBadge({ branches }: { branches: BranchInfo[] }) {
  const issueCount = branches.reduce((sum, branch) => sum + branch.status.issueCount, 0);
  const withoutCalendar = branches.filter((branch) => !branch.status.hasCalendar).length;

  if (issueCount > 0) {
    return <StatusPill tone="amber" label={`${issueCount} dato${issueCount !== 1 ? "s" : ""} pendiente${issueCount !== 1 ? "s" : ""}`} />;
  }

  if (withoutCalendar > 0) {
    return <StatusPill tone="blue" label={`${withoutCalendar} calendario${withoutCalendar !== 1 ? "s" : ""} pendiente${withoutCalendar !== 1 ? "s" : ""}`} />;
  }

  return <StatusPill tone="green" label={`Listo · ${MONTHS_ES[DEFAULT_MONTH - 1]}`} />;
}

function getBranchActionLabel(branch: BranchInfo): string {
  if (branch.status.issueCount > 0) return "Revisar datos";
  return branch.status.hasCalendar ? "Ver calendario" : "Generar calendario";
}

function getGroupActionLabel(branches: BranchInfo[]): string {
  const issueCount = branches.reduce((sum, branch) => sum + branch.status.issueCount, 0);
  if (issueCount > 0) return "Revisar datos";
  return branches.some((branch) => !branch.status.hasCalendar) ? "Generar calendarios" : "Ver calendarios";
}

function StatusPill({ tone, label }: { tone: "green" | "amber" | "rose" | "blue"; label: string }) {
  const toneClasses = {
    green: "bg-green-50 text-green-700 border-green-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
