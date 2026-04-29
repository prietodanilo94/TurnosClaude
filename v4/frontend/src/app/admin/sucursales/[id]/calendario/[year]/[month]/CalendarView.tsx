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

// Feriados irrenunciables Chile: [mes, día] (año fijo)
const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1],   // Año Nuevo
  [5, 1],   // Día del Trabajador
  [9, 18],  // Independencia
  [9, 19],  // Glorias del Ejército
  [12, 25], // Navidad
];

function isFeriadoIrrenunciable(d: Date): boolean {
  return FERIADOS_IRRENUNCIABLES.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

function shiftDuration(s: DayShift): number {
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total; // descuenta 1h colación en turnos ≥ 6h
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
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
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
      if (calId) {
        await fetch(`/api/calendars?id=${calId}`, { method: "DELETE" });
      }
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

  // Vendedores ya asignados a otros slots (para mostrar quiénes están ocupados)
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

      {/* Header sucursal + acciones */}
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleRecalcular}
            disabled={recalculating || !calId}
            className="px-3 py-1.5 text-sm border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!calId ? "No hay calendario guardado" : "Borrar y regenerar plantilla"}
          >
            {recalculating ? "Borrando…" : "Recalcular parcial"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              dirty
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 text-gray-400 cursor-default"
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

      {/* Selector mes/año */}
      <div className="mb-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
        <h2 className="text-lg font-medium text-gray-800">
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

      {/* Grilla por semanas ISO */}
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

      {/* Vista por día (Gantt) */}
      {selectedDay && (
        <VistaPorDia
          dateStr={selectedDay}
          slots={slots}
          assign={assign}
          workerMap={workerMap}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Vista por vendedor */}
      <VistaPorVendedor
        year={year}
        month={month}
        slots={slots}
        assign={assign}
        workerMap={workerMap}
      />

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

// ─── Vista por vendedor ───────────────────────────────────────────────────────

const DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

interface VistaPorVendedorProps {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
}

function VistaPorVendedor({ year, month, slots, assign, workerMap }: VistaPorVendedorProps) {
  const [open, setOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(slots[0]?.slotNumber ?? 1);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return { date: d, dateStr: fmt(d), dow: dowIndex(d), day: i + 1 };
  });

  const slot = slots.find((s) => s.slotNumber === activeSlot);
  const workerId = assign[String(activeSlot)] ?? null;
  const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${activeSlot}`;
  const color = workerColor(activeSlot);

  let totalHours = 0;
  let workDays = 0;
  if (slot) {
    for (const { dateStr, date } of days) {
      const shift = slot.days[dateStr];
      if (shift && !isFeriadoIrrenunciable(date)) {
        totalHours += shiftDuration(shift);
        workDays++;
      }
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        Vista por vendedor
      </button>

      {open && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {/* Tabs de slots */}
          <div className="flex flex-wrap gap-1 p-3 border-b border-gray-100 bg-gray-50">
            {slots.map((s) => {
              const wid = assign[String(s.slotNumber)] ?? null;
              const name = wid ? (workerMap[wid] ?? `V${s.slotNumber}`) : `Slot ${s.slotNumber}`;
              const c = workerColor(s.slotNumber);
              const isActive = s.slotNumber === activeSlot;
              return (
                <button
                  key={s.slotNumber}
                  onClick={() => setActiveSlot(s.slotNumber)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                    isActive
                      ? `${c.bg} ${c.text} ${c.border}`
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.bg} border ${c.border}`} />
                  {name.split(" ")[0]}
                </button>
              );
            })}
          </div>

          {/* Cabecera del vendedor seleccionado */}
          <div className={`px-4 py-2 border-b border-gray-100 flex items-center gap-3`}>
            <span className={`w-3 h-3 rounded-full ${color.bg} border ${color.border}`} />
            <span className="text-sm font-semibold text-gray-800">{workerName}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {workDays} días trabajados · {Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}h mensuales
            </span>
          </div>

          {/* Grilla de días del mes */}
          <div className="p-3 overflow-x-auto">
            <div className="flex gap-1 flex-wrap">
              {days.map(({ date, dateStr, dow, day }) => {
                const shift = slot?.days[dateStr];
                const feriado = isFeriadoIrrenunciable(date);
                const isWeekend = dow >= 5;
                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center rounded border text-[10px] w-14 py-1 ${
                      feriado
                        ? "bg-red-50 border-red-200"
                        : shift && !feriado
                        ? `${color.bg} ${color.border}`
                        : isWeekend
                        ? "bg-orange-50 border-orange-100"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className={`font-semibold ${feriado ? "text-red-500" : "text-gray-500"}`}>
                      {DOW_SHORT[dow]}
                    </span>
                    <span className={`text-base font-bold leading-tight ${
                      feriado ? "text-red-400" : shift ? color.text : "text-gray-300"
                    }`}>
                      {day}
                    </span>
                    {feriado ? (
                      <span className="text-red-400 italic mt-0.5">fer.</span>
                    ) : shift ? (
                      <>
                        <span className={`${color.text} font-medium mt-0.5`}>{shift.start}</span>
                        <span className={`${color.text} opacity-70`}>{shift.end}</span>
                      </>
                    ) : (
                      <span className="text-gray-300 italic">libre</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bloque de semana ─────────────────────────────────────────────────────────

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Cabecera de semana */}
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
                    {isFeriado && !isSelected && <div className="text-[9px] font-normal text-red-500 leading-none mt-0.5">feriado</div>}
                    {isSelected && <div className="text-[9px] font-normal leading-none mt-0.5 opacity-80">▼ Gantt</div>}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100 w-20">
                Hrs Sem
              </th>
            </tr>
          </thead>
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
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors`}
                    onClick={() => onSlotClick(slot.slotNumber)}
                    title="Click para asignar vendedor"
                  >
                    <div className={`flex items-center gap-2`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${color.bg} border ${color.border}`} />
                      <span className={`text-sm font-medium truncate ${workerId ? "text-gray-900" : "text-gray-500 italic"}`}>
                        {workerName}
                      </span>
                    </div>
                  </td>
                  {cells.map(({ dateStr, shift, inMonth, ci, feriado }) => (
                    <td
                      key={ci}
                      className={`px-1 py-1.5 text-center text-xs border-l border-gray-100 ${
                        inMonth ? "" : "opacity-40"
                      } ${feriado ? "bg-red-50/60" : ""}`}
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
                    {totalHours > 0 ? `${Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}h` : "—"}
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

// ─── Vista por día (Gantt) ────────────────────────────────────────────────────

interface VistaPorDiaProps {
  dateStr: string;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  onClose: () => void;
}

function minutesFromTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function VistaPorDia({ dateStr, slots, assign, workerMap, onClose }: VistaPorDiaProps) {
  const date = new Date(dateStr + "T12:00:00");
  const dayLabel = `${DOW_LABELS[dowIndex(date)]} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  const feriado = isFeriadoIrrenunciable(date);

  // Calcular rango horario del día
  const activeSlots = slots
    .map((slot) => ({
      slot,
      shift: slot.days[dateStr] ?? null,
      workerId: assign[String(slot.slotNumber)] ?? null,
    }))
    .filter(({ shift }) => shift !== null);

  const allStarts = activeSlots.map(({ shift }) => minutesFromTime(shift!.start));
  const allEnds   = activeSlots.map(({ shift }) => minutesFromTime(shift!.end));
  const axisStart = activeSlots.length > 0 ? Math.min(...allStarts) - 30 : 8 * 60;
  const axisEnd   = activeSlots.length > 0 ? Math.max(...allEnds)   + 30 : 20 * 60;
  const axisRange = axisEnd - axisStart;

  // Marcas de hora en el eje
  const hourMarks: number[] = [];
  const startHour = Math.ceil(axisStart / 60);
  const endHour   = Math.floor(axisEnd / 60);
  for (let h = startHour; h <= endHour; h++) hourMarks.push(h);

  function pct(min: number) { return ((min - axisStart) / axisRange) * 100; }

  return (
    <div className="mt-4 bg-white border border-blue-200 rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-2">
        <span className="text-sm font-semibold">
          Gantt del día — {dayLabel}
          {feriado && <span className="ml-2 text-xs bg-red-400 px-2 py-0.5 rounded-full">Feriado irrenunciable</span>}
        </span>
        <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">×</button>
      </div>

      {activeSlots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 text-center">
          {feriado ? "Feriado irrenunciable — sin turnos." : "No hay turnos asignados para este día."}
        </p>
      ) : (
        <div className="p-4">
          {/* Eje de tiempo */}
          <div className="relative mb-1 ml-32">
            <div className="flex">
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute text-[10px] text-gray-400 -translate-x-1/2"
                  style={{ left: `${pct(h * 60)}%` }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div className="h-4" />
          </div>

          {/* Filas por slot */}
          <div className="space-y-2">
            {slots.map((slot) => {
              const shift = slot.days[dateStr] ?? null;
              const workerId = assign[String(slot.slotNumber)] ?? null;
              const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slot.slotNumber}`;
              const color = workerColor(slot.slotNumber);

              return (
                <div key={slot.slotNumber} className="flex items-center gap-2">
                  <div className="w-28 flex items-center gap-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${color.bg} border ${color.border} shrink-0`} />
                    <span className="text-[11px] text-gray-700 truncate">{workerName.split(" ")[0]}</span>
                  </div>
                  <div className="flex-1 relative h-7 bg-gray-100 rounded">
                    {/* Líneas de hora */}
                    {hourMarks.map((h) => (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-gray-200"
                        style={{ left: `${pct(h * 60)}%` }}
                      />
                    ))}
                    {shift && !feriado ? (
                      <div
                        className={`absolute top-1 bottom-1 rounded ${color.bg} ${color.border} border flex items-center justify-center overflow-hidden`}
                        style={{
                          left:  `${pct(minutesFromTime(shift.start))}%`,
                          width: `${pct(minutesFromTime(shift.end)) - pct(minutesFromTime(shift.start))}%`,
                        }}
                      >
                        <span className={`text-[10px] font-medium ${color.text} px-1 truncate`}>
                          {shift.start}–{shift.end}
                        </span>
                      </div>
                    ) : feriado ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-red-400 italic">feriado</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-gray-400 italic">libre</span>
                      </div>
                    )}
                  </div>
                  <div className="w-16 text-right text-[10px] text-gray-500 shrink-0">
                    {shift && !feriado ? `${shiftDuration(shift).toFixed(1)}h` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
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
