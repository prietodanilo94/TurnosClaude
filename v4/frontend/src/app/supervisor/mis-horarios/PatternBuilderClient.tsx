"use client";

import { useState, useRef, useEffect } from "react";
import type { DayShift, WeekPattern } from "@/types";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DEFAULT_START = "09:00";
const DEFAULT_END = "18:30";
const MAX_CONSECUTIVE = 6;

interface SavedPattern {
  id: string;
  label: string;
  areaNegocio: "ventas" | "postventa";
  rotationWeeks: WeekPattern[];
  weeklyHours: number[];
}

interface Props {
  initialPatterns: SavedPattern[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcWeekHours(week: WeekPattern): number {
  let total = 0;
  for (const shift of week) {
    if (!shift) continue;
    const [h1, m1] = shift.start.split(":").map(Number);
    const [h2, m2] = shift.end.split(":").map(Number);
    const raw = (h2 * 60 + m2 - h1 * 60 - m1) / 60;
    total += raw >= 6 ? raw - 1 : raw; // descanso si turno >= 6h
  }
  return Math.round(total * 10) / 10;
}

function countOffSundaysPerCycle(weeks: WeekPattern[]): number {
  return weeks.filter((w) => !w[6]).length;
}

function maxConsecutiveInPattern(weeks: WeekPattern[]): number {
  const flat = [...weeks.flat(), ...weeks.flat()]; // 2 ciclos para cruzar bordes
  let maxRun = 0;
  let cur = 0;
  let prev: DayShift | null | undefined = undefined;
  for (const cell of flat) {
    if (cell !== null && cell !== undefined) {
      cur = prev !== null && prev !== undefined ? cur + 1 : 1;
      maxRun = Math.max(maxRun, cur);
    } else {
      cur = 0;
    }
    prev = cell;
  }
  return maxRun;
}

function hasConsecutiveOffSundaysInPattern(weeks: WeekPattern[]): boolean {
  for (let i = 0; i < weeks.length; i++) {
    const next = (i + 1) % weeks.length;
    if (!weeks[i][6] && !weeks[next][6]) return true;
  }
  return false;
}

function wouldExceedConsecutive(
  weeks: WeekPattern[],
  weekIdx: number,
  dayIdx: number,
): boolean {
  const N = weeks.length;
  const flat = [...weeks.flat(), ...weeks.flat(), ...weeks.flat()];
  const pos = N * 7 + weekIdx * 7 + dayIdx; // middle copy

  let before = 0;
  for (let i = pos - 1; i >= 0 && before < MAX_CONSECUTIVE; i--) {
    if (!flat[i]) break;
    before++;
  }

  let after = 0;
  for (let i = pos + 1; i < flat.length && after < MAX_CONSECUTIVE; i++) {
    if (!flat[i]) break;
    after++;
  }

  return before + after + 1 > MAX_CONSECUTIVE;
}

function emptyWeeks(n: number): WeekPattern[] {
  return Array.from({ length: n }, () => Array(7).fill(null) as WeekPattern);
}

// ─── sub-components ──────────────────────────────────────────────────────────

function PatternCard({
  pattern,
  onDelete,
}: {
  pattern: SavedPattern;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const res = await fetch(`/api/supervisor/patterns/${pattern.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete(pattern.id);
    } else {
      alert("Error al eliminar");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{pattern.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
            {pattern.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
          </span>
          <span className="text-[10px] text-gray-400">
            {pattern.rotationWeeks.length} sem · {pattern.weeklyHours.map((h) => `${h}h`).join(" / ")}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {pattern.rotationWeeks.map((week, wi) => (
            <div key={wi} className="flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 mr-0.5">S{wi + 1}:</span>
              {week.map((shift, di) => (
                <span
                  key={di}
                  title={DOW[di]}
                  className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-medium border ${
                    shift
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                >
                  {DOW[di][0]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className={`shrink-0 text-xs px-2.5 py-1.5 rounded border transition-colors ${
          confirming
            ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
            : "text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600"
        } disabled:opacity-50`}
      >
        {deleting ? "…" : confirming ? "Confirmar" : "Eliminar"}
      </button>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PatternBuilderClient({ initialPatterns }: Props) {
  const [patterns, setPatterns] = useState<SavedPattern[]>(initialPatterns);
  const [showForm, setShowForm] = useState(initialPatterns.length === 0);

  // form state
  const [label, setLabel] = useState("");
  const [areaNegocio, setAreaNegocio] = useState<"ventas" | "postventa">("ventas");
  const [rotLen, setRotLen] = useState<1 | 2 | 4>(2);
  const [weeks, setWeeks] = useState<WeekPattern[]>(() => emptyWeeks(2));

  // inline cell editor
  const [editingCell, setEditingCell] = useState<{ wi: number; di: number } | null>(null);
  const [editStart, setEditStart] = useState(DEFAULT_START);
  const [editEnd, setEditEnd] = useState(DEFAULT_END);
  const editorRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync weeks array length when rotLen changes
  useEffect(() => {
    setWeeks((prev) => {
      if (prev.length === rotLen) return prev;
      if (prev.length < rotLen) {
        return [...prev, ...emptyWeeks(rotLen - prev.length)];
      }
      return prev.slice(0, rotLen);
    });
    setEditingCell(null);
  }, [rotLen]);

  // Close editor on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setEditingCell(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Derived validation
  const weeklyHours = weeks.map(calcWeekHours);
  const maxConsec = maxConsecutiveInPattern(weeks);
  const offSundaysCycle = countOffSundaysPerCycle(weeks);
  const hasConsecSundays = hasConsecutiveOffSundaysInPattern(weeks);
  const hoursOk = weeklyHours.every((h) => h <= 42);
  const consecOk = maxConsec <= MAX_CONSECUTIVE;
  const sundaysOk = offSundaysCycle >= 1 && !hasConsecSundays;
  const labelOk = label.trim().length > 0;
  const canSave = labelOk && hoursOk && consecOk && sundaysOk;

  function openCell(wi: number, di: number) {
    const current = weeks[wi][di];
    setEditStart(current?.start ?? DEFAULT_START);
    setEditEnd(current?.end ?? DEFAULT_END);
    setEditingCell({ wi, di });
  }

  function applyCell(shift: DayShift | null) {
    if (!editingCell) return;
    const { wi, di } = editingCell;
    setWeeks((prev) => {
      const next = prev.map((w) => [...w] as WeekPattern);
      next[wi][di] = shift;
      return next;
    });
    setEditingCell(null);
  }

  function handleRotLenChange(n: 1 | 2 | 4) {
    setRotLen(n);
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/supervisor/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), areaNegocio, rotationWeeks: weeks, weeklyHours }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al guardar");
        return;
      }
      setPatterns((prev) => [...prev, {
        id: data.id,
        label: data.label,
        areaNegocio: data.areaNegocio,
        rotationWeeks: JSON.parse(data.rotationJson),
        weeklyHours: JSON.parse(data.weeklyHoursJson),
      }]);
      // reset form
      setLabel("");
      setAreaNegocio("ventas");
      setRotLen(2);
      setWeeks(emptyWeeks(2));
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Existing patterns */}
      {patterns.length > 0 && (
        <div className="space-y-2">
          {patterns.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              onDelete={(id) => setPatterns((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Toggle form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span> Crear nuevo horario
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Nuevo horario personalizado</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              title="Cancelar"
            >
              ×
            </button>
          </div>

          {/* Label + area */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <label className="text-xs font-medium text-gray-600">Nombre</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: Horario Pompeyo Norte"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Área</label>
              <select
                value={areaNegocio}
                onChange={(e) => setAreaNegocio(e.target.value as "ventas" | "postventa")}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ventas">Ventas</option>
                <option value="postventa">Postventa</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Rotación</label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => handleRotLenChange(n)}
                    className={`px-3 py-1.5 transition-colors ${
                      rotLen === n
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    } ${n !== 1 ? "border-l border-gray-300" : ""}`}
                  >
                    {n} sem
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="relative inline-block min-w-full">
              <table className="text-xs border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left px-2 text-gray-400 font-normal w-14" />
                    {DOW.map((d) => (
                      <th key={d} className="text-center px-1 py-1 text-gray-500 font-semibold w-20">{d}</th>
                    ))}
                    <th className="text-center px-1 py-1 text-gray-500 font-semibold w-12">Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      <td className="text-right pr-2 text-gray-400 font-medium align-middle whitespace-nowrap">
                        Sem {wi + 1}
                      </td>
                      {week.map((shift, di) => {
                        const isEditing = editingCell?.wi === wi && editingCell?.di === di;
                        const blocked = !shift && wouldExceedConsecutive(weeks, wi, di);
                        return (
                          <td key={di} className="relative align-middle">
                            <button
                              disabled={blocked}
                              onClick={() => openCell(wi, di)}
                              title={
                                blocked
                                  ? "No permitido: se superarían los 6 días consecutivos"
                                  : shift
                                    ? `${shift.start}–${shift.end} · Click para editar`
                                    : "Libre · Click para asignar turno"
                              }
                              className={`w-full px-1 py-1.5 rounded border text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                isEditing
                                  ? "ring-2 ring-blue-500 border-blue-400"
                                  : blocked
                                    ? "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
                                    : shift
                                      ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100 cursor-pointer"
                                      : "bg-white border-gray-200 text-gray-300 hover:border-blue-300 hover:text-blue-400 cursor-pointer"
                              }`}
                            >
                              {blocked ? (
                                <span className="text-[10px]">🔒</span>
                              ) : shift ? (
                                <span className="text-[10px] font-medium leading-tight">{shift.start}<br />{shift.end}</span>
                              ) : (
                                <span className="text-[10px] italic">libre</span>
                              )}
                            </button>

                            {/* Inline editor popover */}
                            {isEditing && (
                              <div
                                ref={editorRef}
                                className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-44 space-y-2"
                              >
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1">
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Entrada</label>
                                    <input
                                      type="time"
                                      value={editStart}
                                      onChange={(e) => setEditStart(e.target.value)}
                                      className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] text-gray-500 block mb-0.5">Salida</label>
                                    <input
                                      type="time"
                                      value={editEnd}
                                      onChange={(e) => setEditEnd(e.target.value)}
                                      className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => applyCell({ start: editStart, end: editEnd })}
                                    disabled={!editStart || !editEnd || editStart >= editEnd}
                                    className="flex-1 bg-blue-600 text-white rounded px-2 py-1 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Aplicar
                                  </button>
                                  <button
                                    onClick={() => applyCell(null)}
                                    className="flex-1 border border-gray-300 text-gray-600 rounded px-2 py-1 text-xs hover:bg-gray-50"
                                  >
                                    Libre
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className={`text-center font-semibold px-2 ${weeklyHours[wi] > 42 ? "text-red-600" : "text-gray-600"}`}>
                        {weeklyHours[wi] > 0 ? `${weeklyHours[wi]}h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation panel */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-1 text-xs">
            <ValidationRow ok={consecOk} label={`Máx. días consecutivos: ${maxConsec}`} okText="≤ 6 ✓" failText={`${maxConsec} — supera el límite de 6`} />
            <ValidationRow
              ok={sundaysOk}
              label={`Domingos libres/ciclo: ${offSundaysCycle} de ${rotLen}`}
              okText="ok ✓"
              failText={
                offSundaysCycle === 0
                  ? "ningún domingo libre"
                  : hasConsecSundays
                    ? "domingos libres consecutivos"
                    : "sin domingos libres suficientes"
              }
            />
            {weeks.map((_, wi) => (
              <ValidationRow
                key={wi}
                ok={weeklyHours[wi] <= 42}
                label={`Sem ${wi + 1}: ${weeklyHours[wi]}h`}
                okText="≤ 42h ✓"
                failText={`${weeklyHours[wi]}h — supera 42h semanales`}
              />
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Guardando…" : "Guardar horario"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationRow({
  ok,
  label,
  okText,
  failText,
}: {
  ok: boolean;
  label: string;
  okText: string;
  failText: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${ok ? "text-gray-600" : "text-red-700 font-medium"}`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {ok ? "✓" : "✗"}
      </span>
      <span>{label} — {ok ? okText : failText}</span>
    </div>
  );
}
