"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot, DayShift, ShiftCategory, WorkerInfo, WorkerBlockInfo } from "@/types";
import { getOperatingWindow, CATEGORY_LABELS, getWeeklyScheduleSummary } from "@/lib/patterns/catalog";
import {
  buildWorkerBlockDateMap,
  getWorkerBlockReason,
  isWorkerBlockedOnDate,
  type WorkerBlockDateMap,
} from "@/lib/calendar/generator";

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

function addMinutesToTime(t: string, mins: number): string {
  const total = minutesFromTime(t) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function validateConsecutiveDays(days: Record<string, DayShift | null>): boolean {
  const dates = Object.keys(days).sort();
  let run = 0;
  for (const d of dates) {
    if (days[d] !== null) { run++; if (run > 6) return false; } else { run = 0; }
  }
  return true;
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

function shortWorkerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[1].charAt(0)}.`;
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
  workerBlocks?: WorkerBlockInfo[];
  calendarId?: string;
  generateAlert?: string;
  prevAssignments?: Record<string, string | null>;
  nextAssignments?: Record<string, string | null>;
  currentYear?: number;
  currentMonth?: number;
  backHref?: string;
  backLabel?: string;
  onNavigate?: (year: number, month: number) => string;
  onSaveCalendar?: (payload: {
    teamId: string;
    year: number;
    month: number;
    slotsData: CalendarSlot[];
    assignments: Record<string, string | null>;
    id?: string;
  }) => Promise<string | null | void>;
  onRecalculateCalendar?: (payload: {
    year: number;
    month: number;
    currentSlots: CalendarSlot[];
    currentAssignments: Record<string, string | null>;
  }) => Promise<{
    slots: CalendarSlot[];
    assignments?: Record<string, string | null>;
    calendarId?: string;
  } | void>;
  recalculateLabel?: string;
  recalculateConfirmMessage?: string;
  showExportButtons?: boolean;
}

export default function CalendarView({
  branchId, branchName, branchCodigo, teamId, areaNegocio, categoria,
  year, month, slots, assignments, workers, workerMap, calendarId, generateAlert,
  workerBlocks = [], prevAssignments = {}, nextAssignments = {}, currentYear, currentMonth,
  backHref = "/admin/sucursales",
  backLabel = "Sucursales",
  onNavigate,
  onSaveCalendar,
  onRecalculateCalendar,
  recalculateLabel,
  recalculateConfirmMessage,
  showExportButtons = true,
}: Props) {
  const router = useRouter();
  const [localSlots, setLocalSlots] = useState<CalendarSlot[]>(() =>
    slots.map(s => ({ ...s, days: { ...s.days } }))
  );
  const [assign, setAssign] = useState<Record<string, string | null>>(assignments);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calId, setCalId] = useState(calendarId);
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);
  const [shiftEditDialog, setShiftEditDialog] = useState<{ slotNum: number; dateStr: string } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"mensual" | "vendedor" | "diario">("mensual");
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(
    () => new Set(slots.map((s) => s.slotNumber)),
  );

  const weeks = useMemo(() => buildIsoWeeks(year, month), [year, month]);
  const operatingWindow = useMemo(() => getOperatingWindow(categoria), [categoria]);
  const blockMap = useMemo(() => buildWorkerBlockDateMap(workerBlocks), [workerBlocks]);

  // Slots ordenados por horario de inicio dominante en el mes (agrupa turnos iguales)
  const sortedSlots = useMemo(() => {
    function dominantStart(slot: CalendarSlot): string {
      const counts: Record<string, number> = {};
      for (const shift of Object.values(slot.days)) {
        if (shift) counts[shift.start] = (counts[shift.start] ?? 0) + 1;
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return best ? best[0] : "99:99";
    }
    return [...localSlots].sort((a, b) => {
      const diff = dominantStart(a).localeCompare(dominantStart(b));
      return diff !== 0 ? diff : a.slotNumber - b.slotNumber;
    });
  }, [localSlots]);

  // Mapa slotNumber → número de display según orden de sortedSlots
  const slotDisplayNum = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    sortedSlots.forEach((s, i) => { map[s.slotNumber] = i + 1; });
    return map;
  }, [sortedSlots]);

  async function handleSave(): Promise<string | null> {
    setSaving(true);
    try {
      if (onSaveCalendar) {
        const id = await onSaveCalendar({
          teamId,
          year,
          month,
          slotsData: localSlots,
          assignments: assign,
          id: calId,
        });
        if (id) setCalId(id);
        setDirty(false);
        return id ?? calId ?? "saved";
      }

      const res = await fetch("/api/calendars", {
        method: calId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, year, month, slotsData: localSlots, assignments: assign, id: calId }),
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
    const msg = recalculateConfirmMessage ?? (calId
      ? "Esto borrará el calendario guardado y regenerará la plantilla limpia. ¿Continuar?"
      : "Esto regenerará la plantilla limpia descartando los cambios actuales. ¿Continuar?");
    if (!confirm(msg)) return;
    setRecalculating(true);
    try {
      if (onRecalculateCalendar) {
        const result = await onRecalculateCalendar({
          year,
          month,
          currentSlots: localSlots,
          currentAssignments: assign,
        });
        if (result) {
          setLocalSlots(result.slots.map((s) => ({ ...s, days: { ...s.days } })));
          if (result.assignments) setAssign(result.assignments);
          if (result.calendarId !== undefined) setCalId(result.calendarId);
          setDirty(false);
        }
        return;
      }

      if (calId) await fetch(`/api/calendars?id=${calId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRecalculating(false);
    }
  }

  function navigateTo(newYear: number, newMonth: number) {
    router.push(onNavigate ? onNavigate(newYear, newMonth) : `/admin/sucursales/${branchId}/calendario/${newYear}/${newMonth}?team=${teamId}`);
  }

  function handleAssign(slotNum: number, workerId: string | null) {
    setAssign((prev) => ({ ...prev, [String(slotNum)]: workerId }));
    setDirty(true);
    setDialogSlot(null);
  }

  function handleShiftSave(slotNum: number, dateStr: string, newShift: DayShift, redistributeDate?: string | null) {
    setLocalSlots(prev => prev.map(s => {
      if (s.slotNumber !== slotNum) return s;
      const origShift = s.days[dateStr];
      const newDays: Record<string, DayShift | null> = { ...s.days, [dateStr]: newShift };
      if (redistributeDate && origShift) {
        const target = s.days[redistributeDate];
        if (target) {
          const diffMins = Math.round((shiftDuration(origShift) - shiftDuration(newShift)) * 60);
          newDays[redistributeDate] = { ...target, end: addMinutesToTime(target.end, diffMins) };
        }
      }
      return { ...s, days: newDays };
    }));
    setDirty(true);
    setShiftEditDialog(null);
  }

  function handleLibreSwap(slotNum: number, d1: string, d2: string) {
    const slot = localSlots.find(s => s.slotNumber === slotNum);
    if (!slot) return;
    const sh1 = slot.days[d1] ?? null;
    const sh2 = slot.days[d2] ?? null;
    if (sh1 === null && sh2 === null) return;
    const newDays: Record<string, DayShift | null> = { ...slot.days, [d1]: sh2, [d2]: sh1 };
    if (!validateConsecutiveDays(newDays)) {
      alert("Este cambio genera más de 6 días laborales consecutivos.");
      return;
    }
    setLocalSlots(prev => prev.map(s =>
      s.slotNumber !== slotNum ? s : { ...s, days: { ...s.days, [d1]: sh2, [d2]: sh1 } }
    ));
    setDirty(true);
  }

  async function handleExport(mode: "calendar" | "rrhh") {
    if (mode === "rrhh") {
      const unassigned = localSlots.filter((s) => !assign[String(s.slotNumber)]);
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

  // Datos para ShiftEditDialog
  const shiftForEdit = shiftEditDialog
    ? (localSlots.find(s => s.slotNumber === shiftEditDialog.slotNum)?.days[shiftEditDialog.dateStr] ?? null)
    : null;
  const weekForEdit = shiftEditDialog
    ? (weeks.find(w => w.some(d => fmt(d) === shiftEditDialog.dateStr)) ?? null)
    : null;
  const redistributeDays: Array<{ dateStr: string; shift: DayShift; d: Date }> =
    shiftEditDialog && weekForEdit
      ? (weekForEdit
          .map(d => ({
            dateStr: fmt(d),
            shift: localSlots.find(s => s.slotNumber === shiftEditDialog.slotNum)?.days[fmt(d)] ?? null,
            d,
          }))
          .filter((x): x is { dateStr: string; shift: DayShift; d: Date } =>
            x.dateStr !== shiftEditDialog.dateStr &&
            x.shift !== null &&
            !isFeriadoIrrenunciable(x.d) &&
            x.d.getMonth() + 1 === month
          ))
      : [];

  return (
    <div className="p-6">
      <div className="mb-1">
        <Link href={backHref} className="text-xs text-gray-400 hover:text-gray-600">
          ← {backLabel}
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
            <span className="text-gray-600">{CATEGORY_LABELS[categoria]}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{getWeeklyScheduleSummary(categoria)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRecalcular}
            disabled={recalculating}
            className="px-3 py-1.5 text-sm border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Regenerar plantilla limpia desde cero"
          >
            {recalculating ? "Regenerando…" : recalculateLabel ?? "Recalcular"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              dirty ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 text-gray-400 cursor-default"
            }`}
          >
            {saving ? "Guardando…" : dirty ? "Guardar" : calId ? "Guardado" : "Sin guardar"}
          </button>
          {showExportButtons && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Barra: tabs + mes/año */}
      <div className="mb-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5">
        <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => setView("mensual")}
            className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
              view === "mensual" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Calendario Mensual
          </button>
          <button
            onClick={() => setView("vendedor")}
            className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
              view === "vendedor" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Turno por Vendedor
          </button>
          <button
            onClick={() => setView("diario")}
            className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
              view === "diario" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Cobertura del Día
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
      {view === "mensual" ? (
        <div className="space-y-4">
          {weeks.map((week, wi) => (
            <WeekBlock
              key={wi}
              week={week}
              month={currentMonth ?? month}
              slots={sortedSlots}
              assign={assign}
              prevAssignments={prevAssignments}
              nextAssignments={nextAssignments}
              workerMap={workerMap}
              blockMap={blockMap}
              slotDisplayNum={slotDisplayNum}
              onSlotClick={(n) => setDialogSlot(n)}
              selectedDay={selectedDay}
              onDayClick={(ds) => setSelectedDay((prev) => prev === ds ? null : ds)}
              onShiftCellClick={(slotNum, dateStr) => setShiftEditDialog({ slotNum, dateStr })}
              onLibreSwap={handleLibreSwap}
            />
          ))}
        </div>
      ) : view === "vendedor" ? (
        <VendedorTabView
          year={year}
          month={month}
          weeks={weeks}
          slots={sortedSlots}
          assign={assign}
          workerMap={workerMap}
          blockMap={blockMap}
          slotDisplayNum={slotDisplayNum}
          selectedSlots={selectedSlots}
          onToggleSlot={toggleSlot}
          onSelectAll={() => setSelectedSlots(new Set(sortedSlots.map((s) => s.slotNumber)))}
          onDeselectAll={() => setSelectedSlots(new Set())}
        />
      ) : (
        <CoberturaDelMesView
          year={year}
          month={month}
          slots={sortedSlots}
          assign={assign}
          slotDisplayNum={slotDisplayNum}
          workerMap={workerMap}
          blockMap={blockMap}
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

      {/* Modal editar turno */}
      {shiftEditDialog && shiftForEdit && (
        <ShiftEditDialog
          slotNumber={shiftEditDialog.slotNum}
          dateStr={shiftEditDialog.dateStr}
          currentShift={shiftForEdit}
          redistributeDays={redistributeDays}
          operatingWindow={operatingWindow}
          onSave={(newShift, redistributeDate) =>
            handleShiftSave(shiftEditDialog.slotNum, shiftEditDialog.dateStr, newShift, redistributeDate)
          }
          onClose={() => setShiftEditDialog(null)}
        />
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
  prevAssignments: Record<string, string | null>;
  nextAssignments: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
  onSlotClick: (slotNum: number) => void;
  selectedDay: string | null;
  onDayClick: (dateStr: string) => void;
  onShiftCellClick: (slotNum: number, dateStr: string) => void;
  onLibreSwap: (slotNum: number, d1: string, d2: string) => void;
}

function WeekBlock({
  week, month, slots, assign, prevAssignments, nextAssignments, workerMap, blockMap, slotDisplayNum,
  onSlotClick, selectedDay, onDayClick, onShiftCellClick, onLibreSwap,
}: WeekBlockProps) {
  const [dragSource, setDragSource] = useState<{ slotNum: number; dateStr: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ slotNum: number; dateStr: string } | null>(null);

  function assignForDay(d: Date): Record<string, string | null> {
    const dm = d.getMonth() + 1;
    if (dm < month || (dm === 12 && month === 1)) return prevAssignments;
    if (dm > month || (dm === 1 && month === 12)) return nextAssignments;
    return assign;
  }

  const isoWeek = isoWeekNumber(week[0]);
  const rangeLabel = fmtDateRange(week[0], week[6]);
  const weekDateStrs = week.map(fmt);
  const ganttDay = selectedDay && weekDateStrs.includes(selectedDay) ? selectedDay : null;

  function handleDragStart(slotNum: number, dateStr: string) {
    setDragSource({ slotNum, dateStr });
  }

  function handleDragOver(e: React.DragEvent, slotNum: number, dateStr: string) {
    e.preventDefault();
    if (dragSource?.slotNum === slotNum) setDragOver({ slotNum, dateStr });
  }

  function handleDrop(slotNum: number, targetDateStr: string) {
    if (dragSource && dragSource.slotNum === slotNum && dragSource.dateStr !== targetDateStr) {
      onLibreSwap(slotNum, dragSource.dateStr, targetDateStr);
    }
    setDragSource(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    setDragSource(null);
    setDragOver(null);
  }

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
                      <div className="text-[10px] text-blue-400 leading-none mt-0.5">▾</div>
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100 w-20">
                Hrs Sem
              </th>
            </tr>
          </thead>

          {/* Gantt panel */}
          {ganttDay && (
            <tbody>
              <tr>
                <td colSpan={9} className="p-0 border-b border-blue-100">
                  <GanttInline
                    dateStr={ganttDay}
                    slots={slots}
                    assign={assign}
                    workerMap={workerMap}
                    blockMap={blockMap}
                    slotDisplayNum={slotDisplayNum}
                  />
                </td>
              </tr>
            </tbody>
          )}

          <tbody>
            {slots.map((slot, idx) => {
              const workerId = assign[String(slot.slotNumber)] ?? null;
              const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slotDisplayNum[slot.slotNumber] ?? slot.slotNumber}`;
              const color = workerColor(slot.slotNumber);
              const altRow = idx % 2 === 1 ? "bg-gray-50/30" : "";

              let totalHours = 0;
              const cells = week.map((d, ci) => {
                const dateStr = fmt(d);
                const shift = slot.days[dateStr] ?? null;
                const inMonth = d.getMonth() + 1 === month;
                const feriado = isFeriadoIrrenunciable(d);
                const dayAssign = assignForDay(d);
                const dayWorkerId = dayAssign[String(slot.slotNumber)] ?? null;
                const dayWorkerName = dayWorkerId ? (workerMap[dayWorkerId] ?? "?") : null;
                const blockReason = getWorkerBlockReason(blockMap, dayWorkerId, dateStr);
                if (shift && !feriado && blockReason === null) totalHours += shiftDuration(shift);
                return { dateStr, shift, inMonth, ci, feriado, dayWorkerId, dayWorkerName, blockReason };
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
                  {cells.map(({ dateStr, shift, inMonth, ci, feriado, dayWorkerId, dayWorkerName, blockReason }) => {
                    const canDrag = inMonth && !feriado;
                    const isBeingDragged = dragSource?.slotNum === slot.slotNumber && dragSource?.dateStr === dateStr;
                    const isDropTarget = dragOver?.slotNum === slot.slotNumber && dragOver?.dateStr === dateStr;
                    return (
                      <td
                        key={ci}
                        className={`px-1 py-1.5 text-center text-xs border-l border-gray-100 ${inMonth ? "" : "opacity-50"} ${feriado ? "bg-red-50/60" : ""} ${isDropTarget ? "bg-blue-100 rounded" : ""}`}
                      >
                        {feriado ? (
                          <span className="text-[10px] font-medium text-red-400 italic">Feriado</span>
                        ) : blockReason !== null ? (
                          <div
                            title={blockReason || "Bloqueado"}
                            className="px-1 py-1 rounded border border-gray-300 bg-gray-200 text-gray-700"
                          >
                            <div className="text-[10px] font-medium">Bloq.</div>
                            {dayWorkerName && (
                              <div className="text-[8px] leading-none mt-0.5 truncate">
                                {shortWorkerName(dayWorkerName)}
                              </div>
                            )}
                          </div>
                        ) : shift ? (
                          <div
                            draggable={canDrag}
                            onClick={inMonth ? () => onShiftCellClick(slot.slotNumber, dateStr) : undefined}
                            onDragStart={canDrag ? () => handleDragStart(slot.slotNumber, dateStr) : undefined}
                            onDragEnd={handleDragEnd}
                            onDragOver={canDrag ? (e) => handleDragOver(e, slot.slotNumber, dateStr) : undefined}
                            onDrop={canDrag ? () => handleDrop(slot.slotNumber, dateStr) : undefined}
                            className={`px-1 py-1 rounded border text-xs select-none transition-opacity ${
                              isBeingDragged ? "opacity-30" : ""
                            } ${
                              inMonth ? "cursor-pointer hover:brightness-95 active:scale-95" : ""
                            } ${
                              dayWorkerId
                                ? `${color.bg} ${color.text} ${color.border}`
                                : "bg-blue-50 text-blue-600 border-blue-200"
                            }`}
                          >
                            {shift.start}–{shift.end}
                            {!inMonth && dayWorkerName && (
                              <div className="text-[8px] leading-none mt-0.5 opacity-70 truncate">{dayWorkerName.split(" ")[0]}</div>
                            )}
                            {inMonth && dayWorkerName && (
                              <div className="text-[8px] leading-none mt-0.5 opacity-80 truncate">
                                {shortWorkerName(dayWorkerName)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            draggable={canDrag}
                            onDragStart={canDrag ? () => handleDragStart(slot.slotNumber, dateStr) : undefined}
                            onDragEnd={handleDragEnd}
                            onDragOver={canDrag ? (e) => handleDragOver(e, slot.slotNumber, dateStr) : undefined}
                            onDrop={canDrag ? () => handleDrop(slot.slotNumber, dateStr) : undefined}
                            className={`text-[11px] italic select-none transition-all ${
                              isBeingDragged ? "opacity-30" : ""
                            } ${
                              isDropTarget ? "text-blue-500 font-medium" : "text-gray-300"
                            } ${canDrag ? "cursor-grab" : ""}`}
                          >
                            libre
                          </div>
                        )}
                      </td>
                    );
                  })}
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

// ─── Tab: Cobertura del Día ───────────────────────────────────────────────────

interface CoberturaDelMesViewProps {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
}

function CoberturaDelMesView({ year, month, slots, assign, workerMap, blockMap, slotDisplayNum }: CoberturaDelMesViewProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month - 1, d));
  }

  const allDateStrs = days.map(fmt);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set(allDateStrs));
  const [calOpen, setCalOpen] = useState(true);

  function toggleDay(ds: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(ds)) next.delete(ds); else next.add(ds);
      return next;
    });
  }

  function toggleAll() {
    if (selectedDays.size === allDateStrs.length) {
      setSelectedDays(new Set());
    } else {
      setSelectedDays(new Set(allDateStrs));
    }
  }

  const calWeeks = buildIsoWeeks(year, month);

  const visibleDays = days.filter((d) => selectedDays.has(fmt(d)));

  return (
    <div className="space-y-4">
      {/* Mini calendario filtro */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Cabecera colapsable */}
        <div className="flex items-center px-3 py-2">
          <button
            onClick={() => setCalOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span className={`transition-transform duration-200 inline-block ${calOpen ? "rotate-90" : ""}`}>▶</span>
            Filtrar días
            {!calOpen && (
              <span className="ml-1 text-gray-400 font-normal">
                {selectedDays.size === allDateStrs.length ? "(todos)" : `(${selectedDays.size}/${allDateStrs.length})`}
              </span>
            )}
          </button>
        </div>

        {/* Cuerpo */}
        {calOpen && (
          <div className="px-3 pb-3">
            <div className="grid grid-cols-7 mb-0.5" style={{ width: 196 }}>
              {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} className={`w-7 text-center text-[10px] font-semibold ${i >= 5 ? "text-orange-400" : "text-gray-400"}`}>
                  {d}
                </div>
              ))}
            </div>
            <div className="space-y-0.5">
              {calWeeks.map((week, wi) => (
                <div key={wi} className="flex gap-0">
                  {week.map((d, di) => {
                    const ds = fmt(d);
                    const inMonth = d.getMonth() + 1 === month;
                    const selected = selectedDays.has(ds);
                    const isWeekend = di >= 5;
                    const feriado = isFeriadoIrrenunciable(d);
                    if (!inMonth) return <div key={di} className="w-7 h-7" />;
                    return (
                      <button
                        key={di}
                        onClick={() => toggleDay(ds)}
                        title={ds}
                        className={`w-7 h-7 rounded text-[11px] font-medium transition-all select-none flex items-center justify-center ${
                          selected
                            ? feriado ? "bg-red-500 text-white"
                              : isWeekend ? "bg-orange-400 text-white"
                              : "bg-blue-600 text-white"
                            : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2" style={{ width: 196 }}>
              <span className="text-[11px] text-gray-400">
                <span className="font-medium text-gray-600">{selectedDays.size}</span> / {allDateStrs.length} días
              </span>
              <button
                onClick={toggleAll}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {selectedDays.size === allDateStrs.length ? "Quitar todos" : "Todos"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de días con Gantt */}
      {visibleDays.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No hay días seleccionados</div>
      ) : (
        visibleDays.map((d) => {
          const dateStr = fmt(d);
          const dow = dowIndex(d);
          const isWeekend = dow >= 5;
          const feriado = isFeriadoIrrenunciable(d);
          const hasShifts = slots.some((s) => s.days[dateStr] != null);

          return (
            <div key={dateStr} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className={`px-3 py-1.5 text-sm font-medium flex items-center gap-2 ${
                feriado ? "bg-red-600 text-white" :
                isWeekend ? "bg-orange-500 text-white" :
                "bg-blue-700 text-white"
              }`}>
                <span>{DOW_LABELS[dow]} {String(d.getDate()).padStart(2, "0")} — {MONTH_NAMES[month]} {year}</span>
                {feriado && <span className="text-xs font-normal opacity-90 ml-1">· Feriado irrenunciable</span>}
              </div>
              {hasShifts && !feriado ? (
                <GanttInline
                  dateStr={dateStr}
                  slots={slots}
                  assign={assign}
                  workerMap={workerMap}
                  blockMap={blockMap}
                  slotDisplayNum={slotDisplayNum}
                />
              ) : (
                <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
                  {feriado ? "Feriado irrenunciable — sin turnos" : "Sin turnos este día"}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Gantt inline ─────────────────────────────────────────────────────────────

interface GanttInlineProps {
  dateStr: string;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
}

function GanttInline({ dateStr, slots, assign, workerMap, blockMap, slotDisplayNum }: GanttInlineProps) {
  const date = new Date(dateStr + "T12:00:00");
  const feriado = isFeriadoIrrenunciable(date);

  const activeSlots = slots
    .map((slot) => ({
      slot,
      shift: slot.days[dateStr] ?? null,
      workerId: assign[String(slot.slotNumber)] ?? null,
    }))
    .filter(({ shift, workerId }) => shift !== null && !feriado && !isWorkerBlockedOnDate(blockMap, workerId, dateStr));

  if (activeSlots.length === 0) {
    return (
      <div className="px-4 py-3 bg-blue-50/40 text-xs text-gray-400 italic text-center">
        {feriado ? "Feriado irrenunciable" : "Sin turnos asignados este día"}
      </div>
    );
  }

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

      <div className="space-y-1.5">
        {activeSlots.map(({ slot, shift, workerId }) => {
          const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slotDisplayNum[slot.slotNumber] ?? slot.slotNumber}`;
          const color = workerColor(slot.slotNumber);
          const startMin = minutesFromTime(shift!.start);
          const endMin   = minutesFromTime(shift!.end);
          const labHours = shiftDuration(shift!);

          return (
            <div key={slot.slotNumber} className="flex items-center gap-2">
              <div className={`${NAME_W} flex items-center gap-1.5 shrink-0`}>
                <span className={`w-2 h-2 rounded-full ${color.bg} border ${color.border} shrink-0`} />
                <span className="text-[11px] text-gray-700 truncate">{shortWorkerName(workerName)}</span>
              </div>
              <div className="flex-1 relative h-6 bg-white rounded border border-gray-200">
                {hourMarks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}
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
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
  selectedSlots: Set<number>;
  onToggleSlot: (n: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function VendedorTabView({
  year, month, weeks, slots, assign, workerMap, blockMap, slotDisplayNum,
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
          const name = wid ? (workerMap[wid] ?? `Vendedor ${slotDisplayNum[s.slotNumber] ?? s.slotNumber}`) : `Vendedor ${slotDisplayNum[s.slotNumber] ?? s.slotNumber}`;
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
                blockMap={blockMap}
                slotDisplayNum={slotDisplayNum}
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
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
}

function VendedorCalendar({ slot, year, month, weeks, assign, workerMap, blockMap, slotDisplayNum }: VendedorCalendarProps) {
  const workerId = assign[String(slot.slotNumber)] ?? null;
  const displayN = slotDisplayNum[slot.slotNumber] ?? slot.slotNumber;
  const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${displayN}`) : `Vendedor ${displayN}`;
  const color = workerColor(slot.slotNumber);

  const weekData = weeks.map((week) => {
    const isoWeek = isoWeekNumber(week[0]);
    const days = week.map((d) => {
      const dateStr = fmt(d);
      const shift = slot.days[dateStr] ?? null;
      const inMonth = d.getMonth() + 1 === month;
      const feriado = isFeriadoIrrenunciable(d);
      const blockReason = getWorkerBlockReason(blockMap, workerId, dateStr);
      return { d, shift, inMonth, feriado, blockReason };
    });
    return { isoWeek, days };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className={`px-4 py-2 flex items-center gap-3 border-b ${color.border} ${color.bg}`}>
        <span className={`text-sm font-semibold ${color.text}`}>{workerName}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-1.5 text-left text-gray-400 font-medium w-10">Sem</th>
              {DOW_LABELS.map((d) => (
                <th key={d} className="px-2 py-1.5 text-center text-gray-400 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekData.map(({ isoWeek, days }, wi) => (
              <tr key={wi} className="border-t border-gray-50">
                <td className="px-3 py-1.5 text-gray-300 font-medium text-center">{isoWeek}</td>
                {days.map(({ d, shift, inMonth, feriado, blockReason }, ci) => {
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
                      ) : blockReason !== null ? (
                        <div className="rounded text-[8px] leading-tight bg-gray-200 text-gray-700 px-0.5 py-0.5" title={blockReason || "Bloqueado"}>
                          <div>bloq.</div>
                          <div className="opacity-80 truncate">{workerName.split(" ")[0]}</div>
                        </div>
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

// ─── Modal de edición de turno ────────────────────────────────────────────────

interface ShiftEditDialogProps {
  slotNumber: number;
  dateStr: string;
  currentShift: DayShift;
  redistributeDays: Array<{ dateStr: string; shift: DayShift; d: Date }>;
  operatingWindow: { start: string; end: string };
  onSave: (newShift: DayShift, redistributeDate?: string | null) => void;
  onClose: () => void;
}

function ShiftEditDialog({
  slotNumber, dateStr, currentShift, redistributeDays, operatingWindow, onSave, onClose,
}: ShiftEditDialogProps) {
  const color = workerColor(slotNumber);
  const [start, setStart] = useState(currentShift.start);
  const [end, setEnd] = useState(currentShift.end);
  const [step, setStep] = useState<"edit" | "redistribute">("edit");
  const [selectedRedist, setSelectedRedist] = useState<string | null>(null);

  const winStartMin = minutesFromTime(operatingWindow.start);
  const winEndMin   = minutesFromTime(operatingWindow.end);
  const curStartMin = minutesFromTime(start);
  const curEndMin   = minutesFromTime(end);

  const canBack    = curStartMin - 60 >= winStartMin;
  const canForward = curEndMin   + 60 <= winEndMin;
  const validShift = curStartMin < curEndMin;

  const origHours = shiftDuration(currentShift);
  const newHours  = validShift ? shiftDuration({ start, end }) : 0;
  const diffHours = origHours - newHours; // positivo = nuevo es más corto
  const diffMins  = Math.round(diffHours * 60);

  function moveShift(dir: -1 | 1) {
    setStart(addMinutesToTime(start, dir * 60));
    setEnd(addMinutesToTime(end, dir * 60));
  }

  function handleSaveClick() {
    if (!validShift) return;
    if (diffHours > 0.01) {
      setStep("redistribute");
    } else {
      onSave({ start, end });
    }
  }

  const date = new Date(dateStr + "T12:00:00");
  const dayLabel = `${DOW_LABELS[dowIndex(date)]} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

  // ── Paso 2: redistribuir horas ──────────────────────────────────────────────
  if (step === "redistribute") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Este turno tiene {fmtHours(diffHours)} menos
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-3">
              ¿A qué día de la semana deseas agregar {fmtHours(diffHours)}?
            </p>
            {redistributeDays.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2 text-center">
                No hay días con turno disponibles esta semana.
              </p>
            ) : (
              <div className="space-y-1.5">
                {redistributeDays.map(({ dateStr: ds, shift, d }) => {
                  const canAdd = minutesFromTime(shift.end) + diffMins <= winEndMin;
                  const newEnd = canAdd ? addMinutesToTime(shift.end, diffMins) : null;
                  const selected = selectedRedist === ds;
                  const dow = DOW_LABELS[dowIndex(d)];
                  const dayNum = String(d.getDate()).padStart(2, "0");
                  return (
                    <button
                      key={ds}
                      disabled={!canAdd}
                      onClick={() => setSelectedRedist(selected ? null : ds)}
                      className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                        !canAdd
                          ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                          : selected
                            ? "bg-blue-50 border-blue-400 text-blue-800"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span className="font-medium">{dow} {dayNum}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <span>{shift.start}–{shift.end}</span>
                      {canAdd
                        ? <span className="text-blue-500 ml-1.5">→ hasta {newEnd}</span>
                        : <span className="text-gray-400 ml-1.5">(supera límite {operatingWindow.end})</span>
                      }
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
            <button
              onClick={() => onSave({ start, end })}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              No agregar horas
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("edit")}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={() => onSave({ start, end }, selectedRedist)}
                disabled={!selectedRedist}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Paso 1: editar turno ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color.bg} border ${color.border}`} />
            <h3 className="text-sm font-semibold text-gray-900">
              Editar turno — Slot {slotNumber} · {dayLabel}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="text-[11px] text-gray-400 text-center">
            Franja del establecimiento: <span className="font-medium text-gray-600">{operatingWindow.start} – {operatingWindow.end}</span>
          </div>

          {/* Mover turno completo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => moveShift(-1)}
              disabled={!canBack}
              className="flex-1 py-2 text-xs font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
            >
              ◀ Atrasar 1h
            </button>
            <div className={`px-3 py-2 rounded border text-sm font-semibold text-center min-w-[110px] shrink-0 ${color.bg} ${color.text} ${color.border}`}>
              {start} → {end}
            </div>
            <button
              onClick={() => moveShift(1)}
              disabled={!canForward}
              className="flex-1 py-2 text-xs font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
            >
              Adelantar 1h ▶
            </button>
          </div>

          {/* Inputs manuales */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-1 text-center">Inicio</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-gray-300 text-lg mt-4">→</span>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-1 text-center">Final</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Resumen horas */}
          <div className="bg-gray-50 rounded px-3 py-2 text-xs text-center">
            {validShift ? (
              <>
                <span className="font-semibold text-gray-700">{fmtHours(newHours)}</span>
                <span className="text-gray-400"> laborales</span>
                {Math.abs(diffHours) > 0.01 && (
                  <span className={`ml-2 font-medium ${diffHours > 0 ? "text-amber-600" : "text-green-600"}`}>
                    ({diffHours > 0 ? `−${fmtHours(diffHours)}` : `+${fmtHours(-diffHours)}`} vs original)
                  </span>
                )}
              </>
            ) : (
              <span className="text-red-500">Horario inválido</span>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!validShift}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {diffHours > 0.01 ? "Continuar →" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
