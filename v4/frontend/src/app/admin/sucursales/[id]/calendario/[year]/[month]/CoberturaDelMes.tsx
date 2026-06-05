"use client";

import { useState } from "react";
import type { CalendarSlot } from "@/types";
import type { WorkerBlockDateMap } from "@/lib/calendar/generator";
import { GanttInline } from "./GanttInline";
import {
  DOW_LABELS, MONTH_NAMES, buildIsoWeeks, dowIndex, fmt,
  isFeriadoIrrenunciable, type AttendanceByRut,
} from "./calendar-utils";

export interface CoberturaDelMesViewProps {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
  workerRutMap: Record<string, string>;
  attendanceByRut: AttendanceByRut;
}

export function CoberturaDelMesView({ year, month, slots, assign, workerMap, blockMap, slotDisplayNum, workerRutMap, attendanceByRut }: CoberturaDelMesViewProps) {
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
            <p className="text-xs text-gray-500 mb-2">Selecciona los días que quieres ver en el gráfico de cobertura. Haz clic para activar o desactivar cada uno.</p>
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
                  workerRutMap={workerRutMap}
                  attendanceByRut={attendanceByRut}
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
