"use client";

import { useState } from "react";
import { generateCalendar, buildWorkerBlockDateMap, getWorkerBlockReason } from "@/lib/calendar/generator";
import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot, ShiftCategory, WorkerBlockInfo } from "@/types";

export interface TeamSlice {
  teamId: string;
  workerIds: string[];
}

interface WorkerInfo {
  id: string;
  nombre: string;
}

interface Props {
  title: string;
  areaLabel: string;
  categoria: ShiftCategory | null;
  year: number;
  month: number;
  days: string[]; // "YYYY-MM-DD" array
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workers: WorkerInfo[];
  blocks: WorkerBlockInfo[];
  slices: TeamSlice[];
  hasCalendar: boolean;
}

function shortName(n: string) {
  const p = n.trim().split(/\s+/);
  return p.length <= 1 ? (p[0] ?? "") : `${p[0]} ${p[1].charAt(0)}.`;
}

export default function SupervisorCalendarView({
  title, areaLabel, categoria, year, month, days,
  slots: initialSlots, assignments: initialAssignments,
  workers, blocks, slices, hasCalendar: initialHasCalendar,
}: Props) {
  const [slots, setSlots]         = useState<CalendarSlot[]>(initialSlots);
  const [assign, setAssign]       = useState<Record<string, string | null>>(initialAssignments);
  const [dirty, setDirty]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasCalendar, setHasCalendar] = useState(initialHasCalendar);
  const [dialogSlot, setDialogSlot]   = useState<number | null>(null);
  const [error, setError]         = useState("");

  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.nombre]));
  const blockMap  = buildWorkerBlockDateMap(blocks);

  const totalWorkers = slices.reduce((sum, s) => sum + s.workerIds.length, 0);

  // Split combined slots+assignments back into per-team slices for saving
  function buildTeamData() {
    const result: Array<{ teamId: string; slots: CalendarSlot[]; assignments: Record<string, string | null> }> = [];
    let offset = 0;
    for (const slice of slices) {
      const N = slice.workerIds.length;
      const teamSlots = slots
        .filter((s) => s.slotNumber > offset && s.slotNumber <= offset + N)
        .map((s) => ({ ...s, slotNumber: s.slotNumber - offset }));
      const teamAssign: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(assign)) {
        const n = Number(k);
        if (n > offset && n <= offset + N) teamAssign[String(n - offset)] = v;
      }
      result.push({ teamId: slice.teamId, slots: teamSlots, assignments: teamAssign });
      offset += N;
    }
    return result;
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      for (const { teamId, slots: ts, assignments: ta } of buildTeamData()) {
        const res = await fetch("/api/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, year, month, slotsData: ts, assignments: ta }),
        });
        if (!res.ok) { setError("Error al guardar"); return; }
      }
      setDirty(false);
      setHasCalendar(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!categoria || totalWorkers === 0) return;
    setGenerating(true);
    setError("");
    try {
      const { slots: combined } = generateCalendar(categoria, year, month, totalWorkers);
      const newAssign: Record<string, string | null> = {};
      let offset = 0;
      const teamsData: Array<{ teamId: string; slots: CalendarSlot[]; assignments: Record<string, string | null> }> = [];

      for (const slice of slices) {
        const N = slice.workerIds.length;
        const teamSlots = combined
          .filter((s) => s.slotNumber > offset && s.slotNumber <= offset + N)
          .map((s) => ({ ...s, slotNumber: s.slotNumber - offset }));
        const teamAssign: Record<string, string | null> = {};
        slice.workerIds.forEach((wId, i) => {
          teamAssign[String(i + 1)] = wId;
          newAssign[String(i + 1 + offset)] = wId;
        });
        teamsData.push({ teamId: slice.teamId, slots: teamSlots, assignments: teamAssign });
        offset += N;
      }

      for (const { teamId, slots: ts, assignments: ta } of teamsData) {
        const res = await fetch("/api/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, year, month, slotsData: ts, assignments: ta }),
        });
        if (!res.ok) { setError("Error al generar"); return; }
      }

      setSlots(combined);
      setAssign(newAssign);
      setDirty(false);
      setHasCalendar(true);
    } finally {
      setGenerating(false);
    }
  }

  function handleAssign(slotNum: number, workerId: string | null) {
    setAssign((prev) => ({ ...prev, [String(slotNum)]: workerId }));
    setDirty(true);
    setDialogSlot(null);
  }

  function occupiedByOther(slotNum: number): Set<string> {
    const s = new Set<string>();
    for (const [k, v] of Object.entries(assign)) {
      if (Number(k) !== slotNum && v) s.add(v);
    }
    return s;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Cabecera */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{areaLabel}</span>
            {categoria && <span>· {categoria}</span>}
            {!categoria && <span className="text-red-500">· sin categoría</span>}
            {!hasCalendar && categoria && !dirty && (
              <span className="text-amber-600 font-medium">· Sin guardar</span>
            )}
            {dirty && <span className="text-amber-600 font-medium">· Cambios sin guardar</span>}
            <span className="text-gray-400">· {workers.length} vendedores</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          )}
          {categoria && (
            <button
              onClick={handleGenerate}
              disabled={generating || totalWorkers === 0}
              className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generando..." : hasCalendar ? "Regenerar" : "Generar"}
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      {slots.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-400">
          {categoria ? "Presiona Generar para crear el calendario." : "Sin categoría asignada."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[180px] sticky left-0 bg-gray-50 z-10">
                  Vendedor
                </th>
                {days.map((ds) => {
                  const d = new Date(ds + "T12:00:00");
                  return (
                    <th key={ds} className="px-1 py-2 text-center text-gray-500 font-medium min-w-[36px]">
                      {d.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, idx) => {
                const workerId   = assign[String(slot.slotNumber)] ?? null;
                const workerName = workerId
                  ? (workerMap[workerId] ?? "?")
                  : `Vendedor ${slot.slotNumber}`;
                const color   = workerColor(slot.slotNumber);
                const altRow  = idx % 2 === 1 ? "bg-gray-50/40" : "";

                return (
                  <tr key={slot.slotNumber} className={`border-t border-gray-100 hover:bg-gray-50 ${altRow}`}>
                    <td
                      className="px-3 py-2 sticky left-0 bg-white hover:bg-gray-50 cursor-pointer z-10"
                      onClick={() => setDialogSlot(slot.slotNumber)}
                      title="Click para asignar vendedor"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full border ${color.bg} ${color.border} shrink-0`} />
                        <span className={`text-sm font-medium truncate ${workerId ? "text-gray-900" : "text-gray-500 italic"}`}>
                          {workerName}
                        </span>
                      </div>
                    </td>
                    {days.map((ds) => {
                      const shift       = slot.days[ds] ?? null;
                      const blockReason = getWorkerBlockReason(blockMap, workerId, ds);
                      return (
                        <td key={ds} className="px-0.5 py-1 text-center border-l border-gray-100">
                          {blockReason !== null ? (
                            <div title={blockReason || "Bloqueado"} className="rounded bg-gray-200 text-gray-600 px-0.5 py-0.5 text-[9px]">
                              Bloq.
                            </div>
                          ) : shift ? (
                            <div className={`rounded border px-0.5 py-0.5 text-[9px] leading-tight ${
                              workerId
                                ? `${color.bg} ${color.text} ${color.border}`
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}>
                              <div>{shift.start}</div>
                              <div>{shift.end}</div>
                              {workerId && <div className="opacity-60 truncate">{shortName(workerName)}</div>}
                            </div>
                          ) : (
                            <div className="text-gray-200">·</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal asignar */}
      {dialogSlot !== null && (
        <AssignDialog
          slotNumber={dialogSlot}
          currentWorkerId={assign[String(dialogSlot)] ?? null}
          workers={workers}
          occupied={occupiedByOther(dialogSlot)}
          onClose={() => setDialogSlot(null)}
          onAssign={(wId) => handleAssign(dialogSlot, wId)}
        />
      )}
    </div>
  );
}

// ── Modal asignación ──────────────────────────────────────────────────────────

interface AssignDialogProps {
  slotNumber: number;
  currentWorkerId: string | null;
  workers: WorkerInfo[];
  occupied: Set<string>;
  onClose: () => void;
  onAssign: (workerId: string | null) => void;
}

function AssignDialog({ slotNumber, currentWorkerId, workers, occupied, onClose, onAssign }: AssignDialogProps) {
  const color = workerColor(slotNumber);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full border ${color.bg} ${color.border}`} />
            <h3 className="text-sm font-semibold text-gray-900">Asignar vendedor — Vendedor {slotNumber}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {workers
            .filter((w) => !occupied.has(w.id) || w.id === currentWorkerId)
            .map((w) => {
              const isCurrent = w.id === currentWorkerId;
              return (
                <button
                  key={w.id}
                  onClick={() => onAssign(w.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                    isCurrent ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${color.bg} ${color.border}`} />
                  <span className="text-sm text-gray-800 flex-1 truncate">{w.nombre}</span>
                  {isCurrent && <span className="text-xs text-blue-600 font-medium">actual</span>}
                </button>
              );
            })}
        </div>

        {currentWorkerId && (
          <div className="border-t border-gray-200 px-4 py-2.5">
            <button onClick={() => onAssign(null)} className="text-sm text-rose-600 hover:text-rose-800 font-medium">
              Quitar asignación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
