"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot, DayShift, ShiftCategory, WorkerInfo } from "@/types";
import { getOperatingHours } from "@/lib/patterns/catalog";

const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_ABBR = [
  "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function dowIndex(d: Date) { return (d.getDay() + 6) % 7; }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1], [5, 1], [9, 18], [9, 19], [12, 25],
];
function isFeriadoIrrenunciable(d: Date): boolean {
  return FERIADOS_IRRENUNCIABLES.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

function minutesFromTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtHours(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function buildIsoWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - dowIndex(first));
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - dowIndex(last)));
  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

function fmtDateRange(d1: Date, d2: Date): string {
  if (d1.getMonth() === d2.getMonth()) {
    return `${String(d1.getDate()).padStart(2, "0")} – ${String(d2.getDate()).padStart(2, "0")} ${MONTH_ABBR[d2.getMonth() + 1]}`;
  }
  return `${String(d1.getDate()).padStart(2, "0")} ${MONTH_ABBR[d1.getMonth() + 1]} – ${String(d2.getDate()).padStart(2, "0")} ${MONTH_ABBR[d2.getMonth() + 1]}`;
}

interface Props {
  branchId: string;
  branchName: string;
  branchCodigo: string;
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
  branchId, branchName, branchCodigo, teamId, areaNegocio, categoria,
  year, month, slots, assignments, workers, workerMap, calendarId, generateAlert,
}: Props) {
  const router = useRouter();
  const [assign, setAssign] = useState<Record<string, string | null>>(assignments);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calId, setCalId] = useState(calendarId);
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"semanas" | "vendedor">("semanas");
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(
    () => new Set(slots.map((s) => s.slotNumber)),
  );

  const weeks = useMemo(() => buildIsoWeeks(year, month), [year, month]);

  async function handleSave(): Promise<string | null> {
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
        setDirty(false);
        return d.id as string;
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalcular() {
    if (!confirm("Esto borrará el calendario guardado y volverá a generar la plantilla limpia. ¿Continuar?")) return;
    setRecalculating(true);
    try {
      if (calId) await fetch(`/api/calendars?id=${calId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRecalculating(false);
    }
  }

  function navigateTo(newYear: number, newMonth: number) {
    router.push(`/admin/sucursales/${branchId}/calendario/${newYear}/${newMonth}?team=${teamId}`);
  }

  function handleAssign(slotNum: number, workerId: string | null) {
    setAssign((prev) => ({ ...prev, [String(slotNum)]: workerId }));
    setDirty(true);
    setDialogSlot(null);
  }

  async function handleExport(mode: "calendar" | "rrhh") {
    if (mode === "rrhh") {
      const unassigned = slots.filter((s) => !assign[String(s.slotNumber)]);
      if (unassigned.length > 0) {
        alert(`Hay ${unassigned.length} vendedor(es) sin asignar. Asigna todos los slots antes de exportar el Excel RRHH.`);
        return;
      }
    }
    const id = await handleSave();
    if (!id) return;
    window.open(`/api/calendars/export?teamId=${teamId}&year=${year}&month=${month}&mode=${mode}`, "_blank");
  }

  function toggleSlot(n: number) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  const occupiedByOther = (slotNum: number): Set<string> => {
    const set = new Set<string>();
    for (const [k, v] of Object.entries(assign)) {
      if (Number(k) !== slotNum && v) set.add(v);
    }
    return set;
  };

  return (
    <div className="p-6">
      <div className="mb-1">
        <Link href="/admin/sucursales" className="text-xs text-gray-400 hover:text-gray-600">
          ← Sucursales
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{branchName}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{branchCodigo}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              areaNegocio === "ventas" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
            }`}>
              {areaNegocio === "ventas" ? "Ventas" : "Postventa"}
            </span>
            <span>{getOperatingHours(categoria)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRecalcular}
            disabled={recalculating || !calId}
            className="px-3 py-1.5 text-sm border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!calId ? "No hay calendario guardado" : "Borrar y regenerar plantilla"}
          >
            {recalculating ? "Borrando…" : "Recalcular"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              dirty ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 text-gray-400 cursor-default"
            }`}
          >
            {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
          </button>
          <button
            onClick={() => handleExport("calendar")}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Exportar Calendario
          </button>
          <button
            onClick={() => handleExport("rrhh")}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Barra: tabs + mes/año */}
      <div className="mb-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5">
        <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => setView("semanas")}
            className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
              view === "semanas" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Semanas
          </button>
          <button
            onClick={() => setView("vendedor")}
            className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
              view === "vendedor" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Por vendedor
          </button>
        </div>

        <h2 className="text-base font-medium text-gray-700 ml-1">
          {MONTH_NAMES[month]} {year}
        </h2>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => navigateTo(year, Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => navigateTo(Number(e.target.value), month)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {generateAlert && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
          {generateAlert}
        </div>
      )}

      {/* Contenido según tab */}
      {view === "semanas" ? (
        <div className="space-y-4">
          {weeks.map((week, wi) => (
            <WeekBlock
              key={wi}
              week={week}
              month={month}
              slots={slots}
              assign={assign}
              workerMap={workerMap}
              onSlotClick={(n) => setDialogSlot(n)}
              selectedDay={selectedDay}
              onDayClick={(ds) => setSelectedDay((prev) => prev === ds ? null : ds)}
            />
          ))}
        </div>
      ) : (
        <VendedorTabView
          year={year}
          month={month}
          weeks={weeks}
          slots={slots}
          assign={assign}
          workerMap={workerMap}
          selectedSlots={selectedSlots}
          onToggleSlot={toggleSlot}
          onSelectAll={() => setSelectedSlots(new Set(slots.map((s) => s.slotNumber)))}
          onDeselectAll={() => setSelectedSlots(new Set())}
        />
      )}

      {/* Modal asignar vendedor */}
      {dialogSlot !== null && (
        <AssignDialog
          slotNumber={dialogSlot}
          currentWorkerId={assign[String(dialogSlot)] ?? null}
          workers={workers}
          occupied={occupiedByOther(dialogSlot)}
          onClose={() => setDialogSlot(null)}
          onAssign={(wid) => handleAssign(dialogSlot, wid)}
        />
      )}
    </div>
  );
}

// ─── Bloque de semana (con Gantt inline entre header y filas) ─────────────────

interface WeekBlockProps {
  week: Date[];
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  onSlotClick: (slotNum: number) => void;
  selectedDay: string | null;
  onDayClick: (dateStr: string) => void;
}

function WeekBlock({ week, month, slots, assign, workerMap, onSlotClick, selectedDay, onDayClick }: WeekBlockProps) {
  const isoWeek = isoWeekNumber(week[0]);
  const rangeLabel = fmtDateRange(week[0], week[6]);
  const weekDateStrs = week.map(fmt);
  const ganttDay = selectedDay && weekDateStrs.includes(selectedDay) ? selectedDay : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-blue-700 text-white px-3 py-1.5 text-sm font-medium">
        Sem {isoWeek} &nbsp;&nbsp; {rangeLabel}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-44">Vendedor</th>
              {week.map((d, i) => {
                const inMonth = d.getMonth() + 1 === month;
                const isWeekend = i >= 5;
                const isFeriado = isFeriadoIrrenunciable(d);
                const ds = fmt(d);
                const isSelected = selectedDay === ds;
                return (
                  <th
                    key={i}
                    onClick={() => onDayClick(ds)}
                    className={`px-2 py-2 text-center text-xs font-semibold border-l border-gray-100 cursor-pointer select-none transition-colors ${
                      isSelected ? "bg-blue-600 text-white" :
                      isFeriado ? "bg-red-50 text-red-700 hover:bg-red-100" :
                      isWeekend ? "bg-orange-50 text-orange-900 hover:bg-orange-100" :
                      "text-gray-700 hover:bg-blue-50"
                    } ${inMonth ? "" : "opacity-50"}`}
                  >
                    {DOW_LABELS[i]} {String(d.getDate()).padStart(2, "0")}
                    {isSelected ? (
                      <div className="text-[9px] font-normal leading-none mt-0.5 opacity-80">▼ horarios</div>
                    ) : isFeriado ? (
                      <div className="text-[9px] font-normal text-red-500 leading-none mt-0.5">feriado</div>
                    ) : (
                      <div className="text-[8px] opacity-25 leading-none mt-0.5">▾</div>
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100 w-20">
                Hrs Sem
              </th>
            </tr>
          </thead>

          {/* Gantt panel — entre header y filas de vendedores */}
          {ganttDay && (
            <tbody>
              <tr>
                <td colSpan={9} className="p-0 border-b border-blue-100">
                  <GanttInline
                    dateStr={ganttDay}
                    slots={slots}
                    assign={assign}
                    workerMap={workerMap}
                  />
                </td>
              </tr>
            </tbody>
          )}

          <tbody>
            {slots.map((slot, idx) => {
              const workerId = assign[String(slot.slotNumber)] ?? null;
              const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slot.slotNumber}`;
              const color = workerColor(slot.slotNumber);
              const altRow = idx % 2 === 1 ? "bg-gray-50/30" : "";

              let totalHours = 0;
              const cells = week.map((d, ci) => {
                const dateStr = fmt(d);
                const shift = slot.days[dateStr];
                const inMonth = d.getMonth() + 1 === month;
                const feriado = isFeriadoIrrenunciable(d);
                if (shift && !feriado) totalHours += shiftDuration(shift);
                return { dateStr, shift, inMonth, ci, feriado };
              });

              return (
                <tr key={slot.slotNumber} className={`border-b border-gray-100 last:border-b-0 ${altRow}`}>
                  <td
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => onSlotClick(slot.slotNumber)}
                    title="Click para asignar vendedor"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color.bg} border ${color.border}`} />
                      <span className={`text-sm font-medium truncate ${workerId ? "text-gray-900" : "text-gray-500 italic"}`}>
                        {workerName}
                      </span>
                    </div>
                  </td>
                  {cells.map(({ shift, inMonth, ci, feriado }) => (
                    <td
                      key={ci}
                      className={`px-1 py-1.5 text-center text-xs border-l border-gray-100 ${inMonth ? "" : "opacity-40"} ${feriado ? "bg-red-50/60" : ""}`}
                    >
                      {feriado ? (
                        <span className="text-[10px] font-medium text-red-400 italic">Feriado</span>
                      ) : shift ? (
                        <div className={`px-1 py-1 rounded border text-xs ${
                          workerId
                            ? `${color.bg} ${color.text} ${color.border}`
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}>
                          {shift.start}–{shift.end}
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-[11px]">libre</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100">
                    {totalHours > 0 ? fmtHours(totalHours) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gantt inline ─────────────────────────────────────────────────────────────

interface GanttInlineProps {
  dateStr: string;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
}

function GanttInline({ dateStr, slots, assign, workerMap }: GanttInlineProps) {
  const date = new Date(dateStr + "T12:00:00");
  const feriado = isFeriadoIrrenunciable(date);

  const activeSlots = slots
    .map((slot) => ({
      slot,
      shift: slot.days[dateStr] ?? null,
      workerId: assign[String(slot.slotNumber)] ?? null,
    }))
    .filter(({ shift }) => shift !== null && !feriado);

  if (activeSlots.length === 0) {
    return (
      <div className="px-4 py-3 bg-blue-50/40 text-xs text-gray-400 italic text-center">
        {feriado ? "Feriado irrenunciable" : "Sin turnos asignados este día"}
      </div>
    );
  }

  // Eje en minutos presenciales
  const allStarts = activeSlots.map(({ shift }) => minutesFromTime(shift!.start));
  const allEnds   = activeSlots.map(({ shift }) => minutesFromTime(shift!.end));
  const axisStart = Math.floor(Math.min(...allStarts) / 60) * 60;
  const axisEnd   = Math.ceil(Math.max(...allEnds) / 60) * 60;
  const axisRange = axisEnd - axisStart;

  const hourMarks: number[] = [];
  for (let h = axisStart / 60; h <= axisEnd / 60; h++) hourMarks.push(h);

  function pct(min: number) { return ((min - axisStart) / axisRange) * 100; }

  const NAME_W = "w-28";

  return (
    <div className="bg-gradient-to-b from-blue-50/60 to-white px-4 pt-2.5 pb-3">
      <div className="text-[10px] text-blue-600 font-semibold mb-2 uppercase tracking-wide">
        {DOW_LABELS[dowIndex(date)]} {String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")} — horarios del día
      </div>

      {/* Eje de tiempo */}
      <div className="flex mb-1">
        <div className={`${NAME_W} shrink-0`} />
        <div className="flex-1 relative h-4">
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute text-[9px] text-gray-400 -translate-x-1/2"
              style={{ left: `${pct(h * 60)}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="w-12 shrink-0" />
      </div>

      {/* Barras */}
      <div className="space-y-1.5">
        {activeSlots.map(({ slot, shift, workerId }) => {
          const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slot.slotNumber}`;
          const color = workerColor(slot.slotNumber);
          const startMin = minutesFromTime(shift!.start);
          const endMin   = minutesFromTime(shift!.end);
          const labHours = shiftDuration(shift!); // horas laborales (−1h colación si ≥ 6h)

          return (
            <div key={slot.slotNumber} className="flex items-center gap-2">
              <div className={`${NAME_W} flex items-center gap-1.5 shrink-0`}>
                <span className={`w-2 h-2 rounded-full ${color.bg} border ${color.border} shrink-0`} />
                <span className="text-[11px] text-gray-700 truncate">{workerName.split(" ")[0]}</span>
              </div>
              <div className="flex-1 relative h-6 bg-white rounded border border-gray-200">
                {hourMarks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}
                {/* Barra presencial (ancho = horas presenciales) */}
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded ${color.bg} ${color.border} border flex items-center justify-center overflow-hidden`}
                  style={{
                    left:  `${pct(startMin)}%`,
                    width: `${pct(endMin) - pct(startMin)}%`,
                  }}
                >
                  <span className={`text-[9px] font-medium ${color.text} px-1 truncate`}>
                    {shift!.start}–{shift!.end}
                  </span>
                </div>
              </div>
              {/* Columna derecha: horas laborales */}
              <div className="w-12 text-right text-[10px] font-medium text-gray-600 shrink-0">
                {fmtHours(labHours)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Vista por vendedor ──────────────────────────────────────────────────

interface VendedorTabViewProps {
  year: number;
  month: number;
  weeks: Date[][];
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  selectedSlots: Set<number>;
  onToggleSlot: (n: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function VendedorTabView({
  year, month, weeks, slots, assign, workerMap,
  selectedSlots, onToggleSlot, onSelectAll, onDeselectAll,
}: VendedorTabViewProps) {
  const allSelected = selectedSlots.size === slots.length;

  return (
    <div>
      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 font-medium mr-1">Mostrar:</span>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            allSelected
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Todos
        </button>
        {slots.map((s) => {
          const color = workerColor(s.slotNumber);
          const wid = assign[String(s.slotNumber)] ?? null;
          const name = wid ? (workerMap[wid] ?? `Vendedor ${s.slotNumber}`) : `Vendedor ${s.slotNumber}`;
          const sel = selectedSlots.has(s.slotNumber);
          return (
            <button
              key={s.slotNumber}
              onClick={() => onToggleSlot(s.slotNumber)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                sel
                  ? `${color.bg} ${color.text} ${color.border}`
                  : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className={`w-2 h-2 rounded-full border ${sel ? `${color.bg} ${color.border}` : "bg-gray-200 border-gray-300"}`} />
              {name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {selectedSlots.size === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">Selecciona al menos un vendedor</div>
      ) : (
        <div className="space-y-4">
          {slots
            .filter((s) => selectedSlots.has(s.slotNumber))
            .map((slot) => (
              <VendedorCalendar
                key={slot.slotNumber}
                slot={slot}
                year={year}
                month={month}
                weeks={weeks}
                assign={assign}
                workerMap={workerMap}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Calendario individual por vendedor ───────────────────────────────────────

interface VendedorCalendarProps {
  slot: CalendarSlot;
  year: number;
  month: number;
  weeks: Date[][];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
}

function VendedorCalendar({ slot, year, month, weeks, assign, workerMap }: VendedorCalendarProps) {
  const workerId = assign[String(slot.slotNumber)] ?? null;
  const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${slot.slotNumber}`) : `Vendedor ${slot.slotNumber}`;
  const color = workerColor(slot.slotNumber);

  const weekData = weeks.map((week) => {
    const isoWeek = isoWeekNumber(week[0]);
    let weekHours = 0;
    const days = week.map((d) => {
      const dateStr = fmt(d);
      const shift = slot.days[dateStr] ?? null;
      const inMonth = d.getMonth() + 1 === month;
      const feriado = isFeriadoIrrenunciable(d);
      if (shift && !feriado && inMonth) weekHours += shiftDuration(shift);
      return { d, shift, inMonth, feriado };
    });
    return { isoWeek, days, weekHours };
  });

  const totalHours = weekData.reduce((s, w) => s + w.weekHours, 0);
  const totalDays  = weekData.reduce(
    (s, w) => s + w.days.filter(({ shift, feriado, inMonth }) => shift && !feriado && inMonth).length,
    0,
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className={`px-4 py-2 flex items-center gap-3 border-b ${color.border} ${color.bg}`}>
        <span className={`text-sm font-semibold ${color.text}`}>{workerName}</span>
        <span className={`text-xs ${color.text} opacity-70 ml-auto`}>
          {totalDays} días · {fmtHours(totalHours)} mensuales
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-1.5 text-left text-gray-400 font-medium w-10">Sem</th>
              {DOW_LABELS.map((d) => (
                <th key={d} className="px-2 py-1.5 text-center text-gray-400 font-medium">{d}</th>
              ))}
              <th className="px-2 py-1.5 text-center text-gray-400 font-medium border-l border-gray-100">Hrs</th>
            </tr>
          </thead>
          <tbody>
            {weekData.map(({ isoWeek, days, weekHours }, wi) => (
              <tr key={wi} className="border-t border-gray-50">
                <td className="px-3 py-1.5 text-gray-300 font-medium text-center">{isoWeek}</td>
                {days.map(({ d, shift, inMonth, feriado }, ci) => {
                  const isWeekend = ci >= 5;
                  return (
                    <td
                      key={ci}
                      className={`px-0.5 py-1 text-center border-l border-gray-50 ${
                        !inMonth ? "opacity-30" : ""
                      } ${feriado ? "bg-red-50" : isWeekend ? "bg-orange-50/30" : ""}`}
                    >
                      <div className="text-[9px] text-gray-300 leading-none mb-0.5">{d.getDate()}</div>
                      {feriado ? (
                        <div className="text-[8px] text-red-400 italic leading-none">fer.</div>
                      ) : shift ? (
                        <div className={`rounded text-[8px] leading-tight ${color.bg} ${color.text} px-0.5 py-0.5`}>
                          <div>{shift.start}</div>
                          <div className="opacity-80">{shift.end}</div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-200 leading-none">—</div>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-500 border-l border-gray-100">
                  {weekHours > 0 ? fmtHours(weekHours) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modal de asignación ──────────────────────────────────────────────────────

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
            <span className={`w-3 h-3 rounded-full ${color.bg} border ${color.border}`} />
            <h3 className="text-sm font-semibold text-gray-900">Asignar vendedor — Slot {slotNumber}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {workers.filter((w) => !occupied.has(w.id) || w.id === currentWorkerId).length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">No hay vendedores disponibles.</p>
          )}
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
                  <span className={`w-2.5 h-2.5 rounded-full ${color.bg} border ${color.border}`} />
                  <span className="text-sm text-gray-800 flex-1 truncate">
                    {w.nombre}
                    {w.esVirtual && <span className="ml-1 text-xs text-gray-400">(virtual)</span>}
                  </span>
                  {isCurrent && <span className="text-xs text-blue-600 font-medium">actual</span>}
                </button>
              );
            })}
        </div>

        {currentWorkerId && (
          <div className="border-t border-gray-200 px-4 py-2.5">
            <button
              onClick={() => onAssign(null)}
              className="text-sm text-rose-600 hover:text-rose-800 font-medium"
            >
              Quitar asignación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
