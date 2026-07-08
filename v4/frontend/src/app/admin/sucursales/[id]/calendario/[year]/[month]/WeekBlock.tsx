"use client";

import { useState, useMemo } from "react";
import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot, DayShift, WeekPattern } from "@/types";


import { getWorkerBlockReason, type WorkerBlockDateMap } from "@/lib/calendar/generator";
import type { PrevMonthShiftsMap } from "@/lib/calendar/validation";
import { GanttInline } from "./GanttInline";
import {
  DOW_LABELS, SEMANA_COLORS, detectSemanaForWeek, fmt, fmtDateRange, fmtHours,
  isFeriadoIrrenunciable, isoWeekNumber, shiftDuration, shortWorkerName, type AttendanceByRut,
} from "./calendar-utils";

export interface WeekBlockProps {
  week: Date[];
  month: number;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  prevAssignments: Record<string, string | null>;
  nextAssignments: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  // Cola real del mes anterior por trabajador: los dias fronterizos se
  // muestran desde lo realmente guardado ese mes, no desde la copia local.
  prevMonthShifts?: PrevMonthShiftsMap;
  slotDisplayNum: Record<number, number>;
  onSlotClick: (slotNum: number) => void;
  selectedDay: string | null;
  onDayClick: (dateStr: string) => void;
  onShiftCellClick: (slotNum: number, dateStr: string) => void;
  onLibreSwap: (slotNum: number, d1: string, d2: string) => void;
  onWorkerSwap: (slotA: number, slotB: number, weekDates: string[]) => void;
  lockedBefore?: string;
  isAdmin?: boolean;
  workerRutMap?: Record<string, string>;
  attendanceByRut?: AttendanceByRut;
  patternRotation?: WeekPattern[];
  localSlots?: CalendarSlot[];
  onSemanaPicker?: (slotNum: number, weekIndex: number) => void;
  year?: number;
  weekIndex?: number;
}

export function WeekBlock({
  week, month, slots, assign, prevAssignments, nextAssignments, workerMap, blockMap, prevMonthShifts, slotDisplayNum,
  onSlotClick, selectedDay, onDayClick, onShiftCellClick, onLibreSwap, onWorkerSwap, lockedBefore, isAdmin = false,
  workerRutMap = {}, attendanceByRut = {},
  patternRotation, localSlots, onSemanaPicker, year, weekIndex: weekIndexProp,
}: WeekBlockProps) {
  const [dragSource, setDragSource] = useState<{ slotNum: number; dateStr: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ slotNum: number; dateStr: string } | null>(null);
  const [workerDragSlot, setWorkerDragSlot] = useState<number | null>(null);
  const [workerDragOver, setWorkerDragOver] = useState<number | null>(null);
  const [sortBySemana, setSortBySemana] = useState(false);

  function assignForDay(d: Date): Record<string, string | null> {
    const dm = d.getMonth() + 1;
    if (dm === month) return assign;
    if (dm === 12 && month === 1) return prevAssignments;
    if (dm === 1 && month === 12) return nextAssignments;
    return dm < month ? prevAssignments : nextAssignments;
  }

  const isoWeek = isoWeekNumber(week[0]);
  const rangeLabel = fmtDateRange(week[0], week[6]);
  // Index of this week within the month (0=first week, 1=second, …)
  // Prefer the explicit prop passed from the parent; fallback to date-based calculation
  const weekIndex = weekIndexProp !== undefined
    ? weekIndexProp
    : (() => { const d = week.find(w => w.getMonth() + 1 === month); return d ? Math.floor((d.getDate() - 1) / 7) : 0; })();
  const weekDateStrs = week.map(fmt);
  const ganttDay = selectedDay && weekDateStrs.includes(selectedDay) ? selectedDay : null;

  const hasRotation = patternRotation && patternRotation.length > 1;
  const displaySlots = useMemo(() => {
    if (!sortBySemana || !hasRotation) return slots;
    return [...slots].sort((a, b) => {
      const activeA = localSlots?.find(s => s.slotNumber === a.slotNumber) ?? a;
      const activeB = localSlots?.find(s => s.slotNumber === b.slotNumber) ?? b;
      const semA = detectSemanaForWeek(activeA, patternRotation!, weekDateStrs);
      const semB = detectSemanaForWeek(activeB, patternRotation!, weekDateStrs);
      if (semA === null && semB === null) return 0;
      if (semA === null) return 1;
      if (semB === null) return -1;
      return semA - semB;
    });
  }, [slots, sortBySemana, hasRotation, patternRotation, weekDateStrs, localSlots]);

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
              {patternRotation && patternRotation.length > 1 && (
                <th
                  onClick={hasRotation ? () => setSortBySemana(v => !v) : undefined}
                  title={hasRotation ? (sortBySemana ? "Volver al orden original" : "Ordenar por semana (S1, S2…)") : undefined}
                  className={`px-1 py-2 text-center text-xs font-semibold w-10 select-none ${
                    hasRotation
                      ? "cursor-pointer hover:bg-blue-100 transition-colors"
                      : ""
                  } ${sortBySemana ? "text-blue-600" : "text-gray-500"}`}
                >
                  Sem {hasRotation ? (sortBySemana ? "↑" : "↕") : ""}
                </th>
              )}
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
                <td colSpan={patternRotation && patternRotation.length > 1 ? 10 : 9} className="p-0 border-b border-blue-100">
                  <GanttInline
                    dateStr={ganttDay}
                    slots={slots}
                    assign={assign}
                    workerMap={workerMap}
                    blockMap={blockMap}
                    slotDisplayNum={slotDisplayNum}
                    workerRutMap={workerRutMap}
                    attendanceByRut={attendanceByRut}
                  />
                </td>
              </tr>
            </tbody>
          )}

          <tbody>
            {/* El orden por semana ya viene resuelto en sortedSlots (padre); sortBySemana permite re-ordenar localmente */}
            {displaySlots.map((slot, idx) => {
              const workerId = assign[String(slot.slotNumber)] ?? null;
              const workerName = workerId ? (workerMap[workerId] ?? "?") : `Vendedor ${slotDisplayNum[slot.slotNumber] ?? slot.slotNumber}`;
              const activeSlot = localSlots?.find(s => s.slotNumber === slot.slotNumber) ?? slot;
              // Semana activa de ESTE bloque: se detecta contra los turnos reales de la semana,
              // así soporta cambios parciales ("desde esta semana") y ediciones manuales.
              const semanaOff = patternRotation && patternRotation.length > 1
                ? detectSemanaForWeek(activeSlot, patternRotation, weekDateStrs)
                : null;
              const color = semanaOff !== null
                ? SEMANA_COLORS[semanaOff % SEMANA_COLORS.length]
                : workerColor(slot.slotNumber);
              const altRow = idx % 2 === 1 ? "bg-gray-50/30" : "";

              let totalHours = 0;
              const realTail = workerId ? prevMonthShifts?.[workerId] : undefined;
              const cells = week.map((d, ci) => {
                const dateStr = fmt(d);
                const inMonth = d.getMonth() + 1 === month;
                const dm = d.getMonth() + 1;
                const isPrevMonthDay = !inMonth && (dm === month - 1 || (month === 1 && dm === 12));
                let shift = slot.days[dateStr] ?? null;
                const dayAssign = assignForDay(d);
                let dayWorkerId = dayAssign[String(slot.slotNumber)] ?? null;
                // Dias del mes ANTERIOR: mostrar lo realmente guardado ese mes
                // para el trabajador de la fila, no la copia local de esta
                // grilla (que puede estar vacia o desactualizada). Mismo
                // criterio que effectiveDays en validation.ts — asi la columna
                // Hrs Sem coincide con el panel de validacion.
                if (isPrevMonthDay && realTail && dateStr in realTail) {
                  shift = realTail[dateStr];
                  dayWorkerId = workerId;
                }
                const feriado = isFeriadoIrrenunciable(d);
                const dayWorkerName = dayWorkerId ? (workerMap[dayWorkerId] ?? "?") : null;
                const blockReason = getWorkerBlockReason(blockMap, dayWorkerId, dateStr);
                if (shift && !feriado && blockReason === null) totalHours += shiftDuration(shift);
                return { dateStr, shift, inMonth, ci, feriado, dayWorkerId, dayWorkerName, blockReason };
              });

              return (
                <tr key={slot.slotNumber} className={`border-b border-gray-100 last:border-b-0 ${altRow}`}>
                  <td
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); setWorkerDragSlot(slot.slotNumber); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (workerDragSlot !== null && workerDragSlot !== slot.slotNumber) setWorkerDragOver(slot.slotNumber); }}
                    onDrop={(e) => { e.stopPropagation(); if (workerDragSlot !== null && workerDragSlot !== slot.slotNumber) onWorkerSwap(workerDragSlot, slot.slotNumber, weekDateStrs); setWorkerDragSlot(null); setWorkerDragOver(null); }}
                    onDragEnd={() => { setWorkerDragSlot(null); setWorkerDragOver(null); }}
                    onClick={() => onSlotClick(slot.slotNumber)}
                    title="Click para asignar · Arrastrar para intercambiar turno"
                    className={`px-3 py-2 cursor-grab hover:bg-gray-100 transition-colors select-none ${
                      workerDragSlot === slot.slotNumber ? "opacity-40" : ""
                    } ${workerDragOver === slot.slotNumber ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color.bg} border ${color.border} shrink-0`} />
                      <span className={`text-sm font-medium truncate ${workerId ? "text-gray-900" : "text-gray-500 italic"}`}>
                        {workerName}
                      </span>
                    </div>
                  </td>
                  {patternRotation && patternRotation.length > 1 && onSemanaPicker && semanaOff !== null && (
                    <td className="px-1 py-2 text-center border-l border-gray-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSemanaPicker(slot.slotNumber, weekIndex); }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${color.bg} ${color.text} ${color.border} hover:opacity-80 transition-opacity`}
                        title="Cambiar semana del turno rotativo"
                      >
                        S{semanaOff + 1}
                      </button>
                    </td>
                  )}
                  {cells.map(({ dateStr, shift, inMonth, ci, feriado, dayWorkerId, dayWorkerName, blockReason }) => {
                    const isPast = !isAdmin && (lockedBefore ? dateStr < lockedBefore : false);
                    const canDrag = inMonth && !feriado && !isPast;
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
                            onClick={inMonth && !isPast ? () => onShiftCellClick(slot.slotNumber, dateStr) : undefined}
                            onDragStart={canDrag ? () => handleDragStart(slot.slotNumber, dateStr) : undefined}
                            onDragEnd={handleDragEnd}
                            onDragOver={canDrag ? (e) => handleDragOver(e, slot.slotNumber, dateStr) : undefined}
                            onDrop={canDrag ? () => handleDrop(slot.slotNumber, dateStr) : undefined}
                            className={`px-1 py-1 rounded border text-xs select-none transition-opacity ${
                              isBeingDragged ? "opacity-30" : ""
                            } ${
                              inMonth && !isPast ? "cursor-pointer hover:brightness-95 active:scale-95" : isPast ? "opacity-60 cursor-default" : ""
                            } ${
                              `${color.bg} ${color.text} ${color.border}`
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
                            onClick={inMonth && !isPast ? () => onShiftCellClick(slot.slotNumber, dateStr) : undefined}
                            onDragStart={canDrag ? () => handleDragStart(slot.slotNumber, dateStr) : undefined}
                            onDragEnd={handleDragEnd}
                            onDragOver={canDrag ? (e) => handleDragOver(e, slot.slotNumber, dateStr) : undefined}
                            onDrop={canDrag ? () => handleDrop(slot.slotNumber, dateStr) : undefined}
                            className={`text-[11px] italic select-none transition-all ${
                              isBeingDragged ? "opacity-30" : ""
                            } ${
                              isDropTarget ? "text-blue-500 font-medium" : "text-gray-300"
                            } ${inMonth && !isPast ? "cursor-pointer hover:text-blue-400" : canDrag ? "cursor-grab" : ""}`}
                          >
                            libre
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2 text-center text-xs font-semibold border-l border-gray-100 ${totalHours > 42 ? "text-red-600" : "text-gray-700"}`}>
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
