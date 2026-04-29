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
          />
        ))}
      </div>

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

// ─── Bloque de semana ─────────────────────────────────────────────────────────

interface WeekBlockProps {
  week: Date[];
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  onSlotClick: (slotNum: number) => void;
}

function WeekBlock({ week, month, slots, assign, workerMap, onSlotClick }: WeekBlockProps) {
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
                return (
                  <th
                    key={i}
                    className={`px-2 py-2 text-center text-xs font-semibold border-l border-gray-100 ${
                      isWeekend ? "bg-orange-50 text-orange-900" : "text-gray-700"
                    } ${inMonth ? "" : "opacity-50"}`}
                  >
                    {DOW_LABELS[i]} {String(d.getDate()).padStart(2, "0")}
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
                if (shift) totalHours += shiftDuration(shift);
                return { dateStr, shift, inMonth, ci };
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
                  {cells.map(({ dateStr, shift, inMonth, ci }) => (
                    <td
                      key={ci}
                      className={`px-1 py-1.5 text-center text-xs border-l border-gray-100 ${
                        inMonth ? "" : "opacity-40"
                      }`}
                    >
                      {shift ? (
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
                    {totalHours > 0 ? `${totalHours.toFixed(1)}h` : "—"}
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
