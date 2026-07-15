"use client";

import { useEffect, useState } from "react";
import { workerColor } from "@/components/calendar/worker-colors";
import type { DayShift, WorkerInfo } from "@/types";
import {
  DOW_LABELS, addMinutesToTime, dowIndex, fmtHours, minutesFromTime, shiftDuration,
} from "./calendar-utils";

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

// Plural para "A todos los [dia] del mes" (Lun=0 .. Dom=6)
const DOW_PLURAL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados", "Domingos"];

export interface AssignDialogProps {
  slotNumber: number;
  currentWorkerId: string | null;
  workers: WorkerInfo[];
  occupied: Set<string>;
  onClose: () => void;
  onAssign: (workerId: string | null) => void;
}

export function AssignDialog({ slotNumber, currentWorkerId, workers, occupied, onClose, onAssign }: AssignDialogProps) {
  useEscapeToClose(onClose);
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

export interface ShiftEditDialogProps {
  slotNumber: number;
  dateStr: string;
  workerName?: string;
  currentShift: DayShift | null;
  originalShift?: DayShift;
  redistributeDays: Array<{ dateStr: string; shift: DayShift; d: Date }>;
  operatingWindow: { start: string; end: string };
  onSave: (newShift: DayShift, redistributeDate: string | null | undefined, scope: "week" | "isoweek" | "month") => void;
  onClose: () => void;
  onSetLibre?: (scope: "week" | "isoweek" | "month") => void;
}

export function ShiftEditDialog({
  slotNumber, dateStr, workerName, currentShift, originalShift, redistributeDays, operatingWindow, onSave, onClose, onSetLibre,
}: ShiftEditDialogProps) {
  useEscapeToClose(onClose);
  const color = workerColor(slotNumber);
  const [start, setStart] = useState(currentShift?.start ?? operatingWindow.start);
  const [end, setEnd] = useState(currentShift?.end ?? operatingWindow.end);
  const [step, setStep] = useState<"edit" | "redistribute">("edit");
  const [selectedRedist, setSelectedRedist] = useState<string | null>(null);
  // "week" = solo este dia (nombre historico), "isoweek" = toda la semana,
  // "month" = todos los [dia de semana] del mes.
  const [scope, setScope] = useState<"week" | "isoweek" | "month">("week");

  const winStartMin = minutesFromTime(operatingWindow.start);
  const winEndMin   = minutesFromTime(operatingWindow.end);
  const curStartMin = minutesFromTime(start);
  const curEndMin   = minutesFromTime(end);

  const canBack60   = curStartMin - 60 >= winStartMin;
  const canForward60 = curEndMin + 60 <= winEndMin;
  const canBack30   = curStartMin - 30 >= winStartMin;
  const canForward30 = curEndMin + 30 <= winEndMin;

  const withinWindow = curStartMin >= winStartMin && curEndMin <= winEndMin;
  const rawHours = curStartMin < curEndMin ? (curEndMin - curStartMin) / 60 : 0;
  const netHours = rawHours >= 6 ? rawHours - 1 : rawHours;
  const validShift = curStartMin < curEndMin && withinWindow;

  const baseHours = originalShift ? shiftDuration(originalShift) : (currentShift ? shiftDuration(currentShift) : 0);
  const newHours  = validShift ? shiftDuration({ start, end }) : 0;
  const diffHours = baseHours - newHours; // positivo = nuevo está por debajo del original
  const diffMins  = Math.round(diffHours * 60);

  function moveShift(mins: number) {
    setStart(addMinutesToTime(start, mins));
    setEnd(addMinutesToTime(end, mins));
  }

  function shiftValidationError(): string | null {
    if (curStartMin >= curEndMin) return "La hora de inicio debe ser anterior a la hora de término.";
    if (!withinWindow) return `El turno debe estar dentro de la franja ${operatingWindow.start}–${operatingWindow.end}.`;
    return null;
  }

  function handleSaveClick() {
    if (!validShift) return;
    if (diffHours > 0.01 && scope === "week") {
      setStep("redistribute");
    } else {
      onSave({ start, end }, null, scope);
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
              onClick={() => onSave({ start, end }, null, scope)}
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
                onClick={() => onSave({ start, end }, selectedRedist, scope)}
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
              {currentShift ? "Editar turno" : "Agregar turno"}{workerName ? ` — ${workerName}` : ""} · {dayLabel}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="text-[11px] text-gray-400 text-center">
            Franja del establecimiento: <span className="font-medium text-gray-600">{operatingWindow.start} – {operatingWindow.end}</span>
          </div>

          {/* Mover turno completo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => moveShift(-60)}
                disabled={!canBack60}
                className="flex-1 py-2 text-xs font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                ◀ Atrasar 1h
              </button>
              <div className={`px-3 py-2 rounded border text-sm font-semibold text-center min-w-[110px] shrink-0 ${color.bg} ${color.text} ${color.border}`}>
                {start} → {end}
              </div>
              <button
                onClick={() => moveShift(60)}
                disabled={!canForward60}
                className="flex-1 py-2 text-xs font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                Adelantar 1h ▶
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => moveShift(-30)}
                disabled={!canBack30}
                className="flex-1 py-1.5 text-[11px] font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-200 hover:bg-gray-50 text-gray-500"
              >
                ◀ 30 min
              </button>
              <div className="min-w-[110px] shrink-0" />
              <button
                onClick={() => moveShift(30)}
                disabled={!canForward30}
                className="flex-1 py-1.5 text-[11px] font-medium border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-gray-200 hover:bg-gray-50 text-gray-500"
              >
                30 min ▶
              </button>
            </div>
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
              <span className="text-red-500">{shiftValidationError() ?? "Horario inválido"}</span>
            )}
          </div>
        </div>

        {/* Alcance del cambio */}
        <div className="px-4 pb-3">
          <p className="text-[11px] text-gray-400 mb-1.5 text-center">Aplicar cambio a</p>
          <div className="flex flex-col rounded-lg border border-gray-200 overflow-hidden text-sm font-medium divide-y divide-gray-200">
            {(["week", "isoweek", "month"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`py-2 transition-colors ${
                  scope === s
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "week" ? "Solo este día" : s === "isoweek" ? "A toda esta semana" : `A todos los ${DOW_PLURAL[dowIndex(date)]} del mes`}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <div>
            {onSetLibre && (
              <button
                onClick={() => onSetLibre(scope)}
                className="px-3 py-1.5 text-xs border border-rose-300 text-rose-600 rounded hover:bg-rose-50 transition-colors"
              >
                Eliminar turno
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
              {diffHours > 0.01 && scope === "week" ? "Continuar →" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
