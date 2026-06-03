"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { WeekPattern } from "@/types";

type PatternRow = {
  id: string;
  label: string;
  areaNegocio: "ventas" | "postventa";
  rotationWeeks: WeekPattern[];
  weeklyHours: number[];
  usageCount: number;
  usedBy: string[];
};

interface Props {
  items: PatternRow[];
}

const DOW = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DOW_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function WeekGrid({ weeks }: { weeks: WeekPattern[] }) {
  return (
    <div className="space-y-1 mt-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-1">
          <span className="text-[10px] text-gray-400 w-5 shrink-0">S{wi + 1}</span>
          <div className="flex gap-0.5 flex-wrap">
            {week.map((shift, di) => (
              <span
                key={di}
                className={`text-[10px] px-1 rounded ${shift ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400 italic"}`}
              >
                {DOW[di]}{shift ? ` ${shift.start}` : " libre"}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Week state helpers ───────────────────────────────────────────────────────

type DayState = { libre: boolean; start: string; end: string };
type WeekState = DayState[];

function emptyWeek(): WeekState {
  return Array.from({ length: 7 }, () => ({ libre: false, start: "09:00", end: "18:00" }));
}

function weekStateToPattern(week: WeekState): WeekPattern {
  return week.map((d) => d.libre ? null : { start: d.start, end: d.end });
}

function patternToWeekState(weeks: WeekPattern[]): WeekState[] {
  return weeks.map((week) =>
    week.map((shift) => shift
      ? { libre: false, start: shift.start, end: shift.end }
      : { libre: true, start: "09:00", end: "18:00" }
    ),
  );
}

function computeWeeklyHours(weeks: WeekState[]): number[] {
  return weeks.map((week) =>
    week.reduce((acc, d) => {
      if (d.libre) return acc;
      const [h1, m1] = d.start.split(":").map(Number);
      const [h2, m2] = d.end.split(":").map(Number);
      const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
      return acc + (total >= 6 ? total - 1 : total);
    }, 0),
  );
}

// ─── Shared week editor ───────────────────────────────────────────────────────

function WeekEditor({
  weeks,
  onSetDay,
}: {
  weeks: WeekState[];
  onSetDay: (wi: number, di: number, field: keyof DayState, value: string | boolean) => void;
}) {
  const weeklyHours = computeWeeklyHours(weeks);
  return (
    <>
      {weeks.map((week, wi) => (
        <div key={wi} className="border border-gray-100 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Semana {wi + 1}</span>
            <span className="text-xs text-gray-400">{weeklyHours[wi]?.toFixed(1) ?? "0"}h netas estimadas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  {DOW_FULL.map((d) => (
                    <th key={d} className="px-1 py-1 text-center font-medium text-gray-500">{d.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {week.map((day, di) => (
                    <td key={di} className="px-1 py-1 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSetDay(wi, di, "libre", !day.libre)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${day.libre ? "bg-gray-100 text-gray-500 border-gray-300" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                        >
                          {day.libre ? "Libre" : "Turno"}
                        </button>
                        {!day.libre && (
                          <>
                            <input
                              type="time"
                              value={day.start}
                              onChange={(e) => onSetDay(wi, di, "start", e.target.value)}
                              className="w-20 px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <input
                              type="time"
                              value={day.end}
                              onChange={(e) => onSetDay(wi, di, "end", e.target.value)}
                              className="w-20 px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Pattern form (create + edit) ────────────────────────────────────────────

function PatternForm({
  initial,
  title,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: PatternRow;
  title: string;
  submitLabel: string;
  onSubmit: (data: { label: string; areaNegocio: "ventas" | "postventa"; rotationWeeks: WeekPattern[]; weeklyHours: number[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [areaNegocio, setAreaNegocio] = useState<"ventas" | "postventa">(initial?.areaNegocio ?? "ventas");
  const [numWeeks, setNumWeeks] = useState(initial?.rotationWeeks.length ?? 2);
  const [weeks, setWeeks] = useState<WeekState[]>(() =>
    initial ? patternToWeekState(initial.rotationWeeks) : [emptyWeek(), emptyWeek()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNumWeeks(n: number) {
    setNumWeeks(n);
    setWeeks((prev) => {
      if (n > prev.length) return [...prev, ...Array.from({ length: n - prev.length }, emptyWeek)];
      return prev.slice(0, n);
    });
  }

  function setDay(wi: number, di: number, field: keyof DayState, value: string | boolean) {
    setWeeks((prev) => {
      const next = prev.map((w) => [...w]);
      next[wi][di] = { ...next[wi][di], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        label: label.trim(),
        areaNegocio,
        rotationWeeks: weeks.map(weekStateToPattern),
        weeklyHours: computeWeeklyHours(weeks),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="bg-white border border-blue-100 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Plaza Maipú Turno A"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Área de negocio</label>
          <select
            value={areaNegocio}
            onChange={(e) => setAreaNegocio(e.target.value as "ventas" | "postventa")}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ventas">Ventas</option>
            <option value="postventa">Postventa</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Semanas de rotación</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleNumWeeks(n)}
              className={`px-3 py-1 rounded text-sm border transition-colors ${numWeeks === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              {n} semana{n > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      <WeekEditor weeks={weeks} onSetDay={setDay} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CategoriasClient({ items }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(item: PatternRow) {
    const warning = item.usageCount > 0
      ? `Esta categoría está siendo usada por ${item.usageCount} equipo(s):\n${item.usedBy.join(", ")}\n\nSi eliminas, esos equipos quedarán sin categoría y no podrán generar calendarios hasta que se asigne una nueva.\n\n¿Continuar?`
      : `¿Eliminar la categoría "${item.label}"?`;
    if (!confirm(warning)) return;
    setDeleting(item.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/patterns/${item.id}`, { method: "DELETE" });
      if (!res.ok) { setDeleteError((await res.json() as { error?: string }).error ?? "Error al eliminar"); return; }
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreate(data: Parameters<React.ComponentProps<typeof PatternForm>["onSubmit"]>[0]) {
    const res = await fetch("/api/admin/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error");
    setShowCreate(false);
    router.refresh();
  }

  async function handleEdit(id: string, data: Parameters<React.ComponentProps<typeof PatternForm>["onSubmit"]>[0]) {
    const res = await fetch(`/api/admin/patterns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Error");
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setShowCreate((v) => !v); setEditing(null); }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showCreate ? "Cancelar" : "+ Nueva categoría"}
        </button>
      </div>

      {showCreate && (
        <PatternForm
          title="Nueva categoría"
          submitLabel="Crear categoría"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Área</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Semanas / Horario</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Equipos</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {item.label}
                      {item.rotationWeeks.length > 1 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium border border-violet-200">
                          Rotativo {item.rotationWeeks.length}S
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium border border-gray-200">
                          Fijo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.areaNegocio === "ventas" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {item.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <WeekGrid weeks={item.rotationWeeks} />
                    <div className="text-[10px] text-gray-400 mt-1">
                      {item.weeklyHours.map((h, i) => `S${i + 1}: ${h}h`).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.usageCount > 0 ? (
                      <span title={item.usedBy.join(", ")}>{item.usageCount} equipo{item.usageCount !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-gray-300">Sin uso</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditing((prev) => prev === item.id ? null : item.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {editing === item.id ? "Cancelar" : "Editar"}
                      </button>
                      <button
                        onClick={() => void handleDelete(item)}
                        disabled={deleting === item.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        {deleting === item.id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
                {editing === item.id && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 bg-blue-50/40">
                      <PatternForm
                        initial={item}
                        title={`Editar: ${item.label}`}
                        submitLabel="Guardar cambios"
                        onSubmit={(data) => handleEdit(item.id, data)}
                        onCancel={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
