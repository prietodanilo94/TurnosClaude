"use client";

import { useState } from "react";
import Link from "next/link";
import { workerColor, UNASSIGNED_COLOR } from "@/components/calendar/worker-colors";
import type { CalendarSlot, DayShift, ShiftCategory, WorkerInfo } from "@/types";
import { CATEGORY_LABELS } from "@/lib/patterns/catalog";

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatShift(s: DayShift | null): string {
  if (!s) return "Libre";
  return `${s.start}–${s.end}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const count = new Date(year, month, 0).getDate();
  for (let d = 1; d <= count; d++) days.push(new Date(year, month - 1, d));
  return days;
}

function getWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let week: Date[] = [];
  const first = days[0];
  const startDow = (first.getDay() + 6) % 7; // Lun=0
  for (let i = 0; i < startDow; i++) week.push(null as unknown as Date);
  for (const d of days) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null as unknown as Date);
    weeks.push(week);
  }
  return weeks;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  branchId: string;
  branchName: string;
  teamId: string;
  areaNegocio: "ventas" | "postventa";
  categoria: ShiftCategory;
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workers: WorkerInfo[];
  workerMap: Record<string, string>;
  calendarId?: string;
  generateAlert?: string;
}

export default function CalendarView({
  branchId, branchName, teamId, areaNegocio, categoria,
  year, month, slots, assignments, workers, workerMap, calendarId, generateAlert,
}: Props) {
  const [view, setView] = useState<"global" | "persona">("global");
  const [assign, setAssign] = useState<Record<string, string | null>>(assignments);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [calId, setCalId] = useState(calendarId);

  const days = getDaysInMonth(year, month);
  const weeks = getWeeks(days);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/calendars", {
        method: calId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, year, month, slotsData: slots, assignments: assign, id: calId }),
      });
      if (res.ok) {
        const d = await res.json();
        setCalId(d.id);
        setSavedMsg("Guardado");
        setTimeout(() => setSavedMsg(""), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(mode: "slots" | "assigned") {
    const url = `/api/calendars/export?teamId=${teamId}&year=${year}&month=${month}&mode=${mode}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `turnos_${branchName}_${month}_${year}_${mode}.xlsx`;
    a.click();
  }

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="mb-1">
        <Link href={`/admin/sucursales/${branchId}?team=${teamId}`} className="text-xs text-gray-400 hover:text-gray-600">
          ← {branchName}
        </Link>
      </div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {MONTH_NAMES[month]} {year}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {areaNegocio === "ventas" ? "Ventas" : "Postventa"} — {CATEGORY_LABELS[categoria]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("slots")}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Exportar plantilla
          </button>
          <button
            onClick={() => handleExport("assigned")}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Exportar asignado
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
        </div>
      </div>

      {generateAlert && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
          {generateAlert}
        </div>
      )}

      {/* Tabs vista */}
      <div className="flex gap-1 mb-4">
        {(["global", "persona"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              view === v
                ? "bg-gray-800 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {v === "global" ? "Vista global" : "Por trabajador"}
          </button>
        ))}
      </div>

      {view === "global" ? (
        <GlobalView
          weeks={weeks}
          slots={slots}
          assign={assign}
          workerMap={workerMap}
          workers={workers}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onAssign={(slotNum, workerId) =>
            setAssign((prev) => ({ ...prev, [String(slotNum)]: workerId }))
          }
        />
      ) : (
        <PersonaView
          weeks={weeks}
          slots={slots}
          assign={assign}
          workers={workers}
          workerMap={workerMap}
        />
      )}
    </div>
  );
}

// ─── Vista Global ─────────────────────────────────────────────────────────────

interface GlobalViewProps {
  weeks: (Date | null)[][];
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  workers: WorkerInfo[];
  selectedSlot: number | null;
  onSelectSlot: (n: number | null) => void;
  onAssign: (slotNum: number, workerId: string | null) => void;
}

function GlobalView({ weeks, slots, assign, workerMap, workers, selectedSlot, onSelectSlot, onAssign }: GlobalViewProps) {
  return (
    <div className="space-y-4">
      {/* Leyenda de slots */}
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => {
          const color = workerColor(slot.slotNumber);
          const workerId = assign[String(slot.slotNumber)] ?? null;
          const workerName = workerId ? (workerMap[workerId] ?? "?") : null;
          const isSelected = selectedSlot === slot.slotNumber;
          return (
            <button
              key={slot.slotNumber}
              onClick={() => onSelectSlot(isSelected ? null : slot.slotNumber)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${color.bg} ${color.text} ${color.border} ${isSelected ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
            >
              T{slot.slotNumber}
              {workerName && <span className="opacity-70">{workerName.split(" ")[0]}</span>}
            </button>
          );
        })}
      </div>

      {/* Asignar trabajador a slot seleccionado */}
      {selectedSlot !== null && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm text-gray-700">Asignar Trabajador {selectedSlot}:</span>
          <select
            value={assign[String(selectedSlot)] ?? ""}
            onChange={(e) => onAssign(selectedSlot, e.target.value || null)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Sin asignar —</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nombre} {w.esVirtual ? "(virtual)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grilla mensual */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Cabecera días */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DOW_LABELS.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="bg-gray-50 min-h-[80px] border-r border-gray-100 last:border-r-0" />;
              const dateStr = fmt(day);
              const dow = (day.getDay() + 6) % 7;
              const isWeekend = dow >= 5;

              return (
                <div
                  key={di}
                  className={`min-h-[80px] p-1 border-r border-gray-100 last:border-r-0 ${isWeekend ? "bg-blue-50/30" : ""}`}
                >
                  <div className="text-xs text-gray-400 mb-1">{day.getDate()}</div>
                  <div className="space-y-0.5">
                    {slots.map((slot) => {
                      const shift = slot.days[dateStr];
                      const color = shift ? workerColor(slot.slotNumber) : UNASSIGNED_COLOR;
                      return (
                        <div
                          key={slot.slotNumber}
                          className={`px-1 py-0.5 rounded text-[10px] leading-tight ${color.bg} ${color.text} border ${color.border}`}
                        >
                          <span className="font-medium">T{slot.slotNumber}</span>
                          {shift ? ` ${shift.start}` : " Libre"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vista Por Persona ────────────────────────────────────────────────────────

interface PersonaViewProps {
  weeks: (Date | null)[][];
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workers: WorkerInfo[];
  workerMap: Record<string, string>;
}

function PersonaView({ weeks, slots, assign, workers, workerMap }: PersonaViewProps) {
  const [selected, setSelected] = useState<string>("all");

  // Construir mapa slot -> worker
  const slotWorker = Object.fromEntries(
    slots.map((s) => [s.slotNumber, assign[String(s.slotNumber)] ?? null]),
  );
  // Slot sin asignar también se muestra
  const displaySlots = selected === "all"
    ? slots
    : slots.filter((s) => slotWorker[s.slotNumber] === selected);

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelected("all")}
          className={`px-3 py-1 text-sm rounded border transition-colors ${selected === "all" ? "bg-gray-800 text-white border-gray-800" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}
        >
          Todos
        </button>
        {slots.map((slot) => {
          const wId = slotWorker[slot.slotNumber];
          const name = wId ? (workerMap[wId] ?? "?") : `T${slot.slotNumber}`;
          const color = workerColor(slot.slotNumber);
          return (
            <button
              key={slot.slotNumber}
              onClick={() => setSelected(wId ?? `slot-${slot.slotNumber}`)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${color.bg} ${color.text} ${color.border}`}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Tabla por semana */}
      {displaySlots.map((slot) => {
        const wId = slotWorker[slot.slotNumber];
        const name = wId ? (workerMap[wId] ?? "?") : `Trabajador ${slot.slotNumber}`;
        const color = workerColor(slot.slotNumber);
        return (
          <div key={slot.slotNumber} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className={`px-3 py-2 flex items-center gap-2 border-b border-gray-200 ${color.bg}`}>
              <span className={`text-sm font-medium ${color.text}`}>{name}</span>
              <span className={`text-xs ${color.text} opacity-60`}>T{slot.slotNumber}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {DOW_LABELS.map((d, i) => (
                      <th key={i} className="px-2 py-1.5 text-center font-medium text-gray-500 border-r border-gray-100 last:border-r-0">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi} className="border-t border-gray-100">
                      {week.map((day, di) => {
                        if (!day) return <td key={di} className="px-2 py-2 bg-gray-50 border-r border-gray-100 last:border-r-0" />;
                        const shift = slot.days[fmt(day)];
                        return (
                          <td key={di} className={`px-2 py-2 text-center border-r border-gray-100 last:border-r-0 ${shift ? "" : "text-gray-300"}`}>
                            <div className="text-[10px] font-medium text-gray-600">{day.getDate()}</div>
                            <div className={shift ? color.text : "text-gray-400"}>
                              {shift ? `${shift.start}` : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
