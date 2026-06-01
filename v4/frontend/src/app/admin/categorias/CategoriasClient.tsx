"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WeekPattern, DayShift } from "@/types";

type PatternItem = {
  id: string;
  label: string;
  areaNegocio: "ventas" | "postventa";
  rotationWeeks: WeekPattern[];
  weeklyHours: number[];
  usageCount: number;
};

type CustomItem = PatternItem & { usedBy: string[] };

interface Props {
  builtIns: PatternItem[];
  custom: CustomItem[];
}

const DOW = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DOW_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function shiftSummary(w: WeekPattern): string {
  return DOW.map((d, i) => {
    const s = w[i];
    return s ? `${d}:${s.start}-${s.end}` : `${d}:libre`;
  }).join("  ");
}

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

// ─── Empty week state ──────────────────────────────────────────────────────

type DayState = { libre: boolean; start: string; end: string };
type WeekState = DayState[];

function emptyWeek(): WeekState {
  return Array.from({ length: 7 }, () => ({ libre: false, start: "09:00", end: "18:00" }));
}

function weekStateToPattern(week: WeekState): WeekPattern {
  return week.map((d) => d.libre ? null : { start: d.start, end: d.end });
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

// ─── Create form ─────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [areaNegocio, setAreaNegocio] = useState<"ventas" | "postventa">("ventas");
  const [numWeeks, setNumWeeks] = useState(2);
  const [weeks, setWeeks] = useState<WeekState[]>([emptyWeek(), emptyWeek()]);
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
      const rotationWeeks = weeks.map(weekStateToPattern);
      const weeklyHours = computeWeeklyHours(weeks);
      const res = await fetch("/api/admin/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), areaNegocio, rotationWeeks, weeklyHours }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const weeklyHours = computeWeeklyHours(weeks);

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Nueva categoría personalizada</h3>

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
                          onClick={() => setDay(wi, di, "libre", !day.libre)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${day.libre ? "bg-gray-100 text-gray-500 border-gray-300" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                        >
                          {day.libre ? "Libre" : "Turno"}
                        </button>
                        {!day.libre && (
                          <>
                            <input
                              type="time"
                              value={day.start}
                              onChange={(e) => setDay(wi, di, "start", e.target.value)}
                              className="w-20 px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <input
                              type="time"
                              value={day.end}
                              onChange={(e) => setDay(wi, di, "end", e.target.value)}
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CategoriasClient({ builtIns, custom }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(item: CustomItem) {
    const warning = item.usageCount > 0
      ? `Esta categoría está siendo usada por ${item.usageCount} equipo(s):\n${item.usedBy.join(", ")}\n\nSi eliminas, esos equipos quedarán sin categoría y no podrán generar calendarios hasta que se asigne una nueva.\n\n¿Continuar?`
      : `¿Eliminar la categoría "${item.label}"?`;
    if (!confirm(warning)) return;
    setDeleting(item.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/patterns/${item.id}`, { method: "DELETE" });
      if (!res.ok) { setDeleteError((await res.json()).error ?? "Error al eliminar"); return; }
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  function handleCreated() {
    setShowCreate(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Custom section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Categorías personalizadas</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showCreate ? "Cancelar" : "+ Nueva categoría"}
        </button>
      </div>

      {showCreate && <CreateForm onCreated={handleCreated} />}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {custom.length === 0 && !showCreate && (
        <p className="text-sm text-gray-400 italic">No hay categorías personalizadas todavía.</p>
      )}

      {custom.length > 0 && (
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
              {custom.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.label}</td>
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
                    <button
                      onClick={() => void handleDelete(item)}
                      disabled={deleting === item.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleting === item.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Built-in section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Categorías incorporadas</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Área</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Semanas / Horario</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Equipos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {builtIns.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.label}
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Incorporada</span>
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
                      <span>{item.usageCount} equipo{item.usageCount !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-gray-300">Sin uso</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
