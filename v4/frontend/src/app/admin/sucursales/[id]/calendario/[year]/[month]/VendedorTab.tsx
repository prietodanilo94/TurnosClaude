"use client";

import { useState } from "react";
import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot } from "@/types";
import { getWorkerBlockReason, type WorkerBlockDateMap } from "@/lib/calendar/generator";
import {
  DOW_LABELS, fmt, fmtHours, isFeriadoIrrenunciable, isoWeekNumber, shiftDuration,
} from "./calendar-utils";

export interface VendedorTabViewProps {
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
  onSlotClick: (slotNum: number) => void;
  onShiftCellClick: (slotNum: number, dateStr: string) => void;
  onLibreSwap: (slotNum: number, d1: string, d2: string) => void;
  lockedBefore?: string;
}

export function VendedorTabView({
  year, month, weeks, slots, assign, workerMap, blockMap, slotDisplayNum,
  selectedSlots, onToggleSlot, onSelectAll, onDeselectAll, onSlotClick, onShiftCellClick, onLibreSwap, lockedBefore,
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
                onSlotClick={onSlotClick}
                onShiftCellClick={onShiftCellClick}
                onLibreSwap={onLibreSwap}
                lockedBefore={lockedBefore}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Calendario individual por vendedor ───────────────────────────────────────

export interface VendedorCalendarProps {
  slot: CalendarSlot;
  year: number;
  month: number;
  weeks: Date[][];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
  onSlotClick: (slotNum: number) => void;
  onShiftCellClick: (slotNum: number, dateStr: string) => void;
  onLibreSwap: (slotNum: number, d1: string, d2: string) => void;
  lockedBefore?: string;
}

export function VendedorCalendar({ slot, year, month, weeks, assign, workerMap, blockMap, slotDisplayNum, onSlotClick, onShiftCellClick, onLibreSwap, lockedBefore }: VendedorCalendarProps) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const workerId = assign[String(slot.slotNumber)] ?? null;
  const displayN = slotDisplayNum[slot.slotNumber] ?? slot.slotNumber;
  const workerName = workerId ? (workerMap[workerId] ?? `Vendedor ${displayN}`) : `Vendedor ${displayN}`;
  const color = workerColor(slot.slotNumber);

  function handleDragStart(dateStr: string) { setDragSource(dateStr); }
  function handleDragEnd() { setDragSource(null); setDragOver(null); }
  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    if (dragSource && dragSource !== dateStr) setDragOver(dateStr);
  }
  function handleDrop(targetDateStr: string) {
    if (dragSource && dragSource !== targetDateStr) {
      onLibreSwap(slot.slotNumber, dragSource, targetDateStr);
    }
    setDragSource(null);
    setDragOver(null);
  }

  let totalMonthHours = 0;
  const weekData = weeks.map((week) => {
    const isoWeek = isoWeekNumber(week[0]);
    let weekHours = 0;
    const days = week.map((d) => {
      const dateStr = fmt(d);
      const shift = slot.days[dateStr] ?? null;
      const inMonth = d.getMonth() + 1 === month;
      const feriado = isFeriadoIrrenunciable(d);
      const blockReason = getWorkerBlockReason(blockMap, workerId, dateStr);
      if (shift && inMonth && !feriado && blockReason === null) {
        const h = shiftDuration(shift);
        weekHours += h;
        totalMonthHours += h;
      }
      return { d, shift, inMonth, feriado, blockReason };
    });
    return { isoWeek, days, weekHours };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div
        className={`px-4 py-2.5 flex items-center gap-3 border-b ${color.border} ${color.bg} cursor-pointer hover:brightness-95 transition-colors select-none`}
        onClick={() => onSlotClick(slot.slotNumber)}
        title="Click para cambiar vendedor asignado"
      >
        <span className={`w-2.5 h-2.5 rounded-full border-2 ${color.border} ${workerId ? color.bg : "bg-white"}`} />
        <span className={`text-sm font-semibold ${color.text}`}>{workerName}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 text-left text-gray-400 font-medium w-12">Sem</th>
              {DOW_LABELS.map((d) => (
                <th key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-600">{d}</th>
              ))}
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 w-16">Hrs</th>
            </tr>
          </thead>
          <tbody>
            {weekData.map(({ isoWeek, days, weekHours }, wi) => (
              <tr key={wi} className="border-t border-gray-100">
                <td className="px-3 py-1.5 text-gray-300 font-medium text-center text-[11px]">{isoWeek}</td>
                {days.map(({ d, shift, inMonth, feriado, blockReason }, ci) => {
                  const isWeekend = ci >= 5;
                  const dateStr = fmt(d);
                  const isPast = lockedBefore ? dateStr < lockedBefore : false;
                  const canDrag = inMonth && !feriado && blockReason === null && !isPast;
                  const canClick = inMonth && !feriado && !isPast;
                  const isBeingDragged = dragSource === dateStr;
                  const isDropTarget = dragOver === dateStr;
                  return (
                    <td
                      key={ci}
                      className={`px-1 py-1.5 text-center border-l border-gray-100 ${
                        !inMonth ? "opacity-30" : ""
                      } ${feriado ? "bg-red-50/60" : isWeekend ? "bg-orange-50/20" : ""} ${
                        isDropTarget ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="text-[9px] text-gray-300 leading-none mb-1">{d.getDate()}</div>
                      {feriado ? (
                        <span className="text-[9px] font-medium text-red-400 italic">Feriado</span>
                      ) : blockReason !== null ? (
                        <div
                          title={blockReason || "Bloqueado"}
                          className="px-1 py-1 rounded border border-gray-300 bg-gray-200 text-gray-600 text-[9px]"
                        >
                          Bloq.
                        </div>
                      ) : shift ? (
                        <div
                          draggable={canDrag}
                          onClick={canClick ? () => onShiftCellClick(slot.slotNumber, dateStr) : undefined}
                          onDragStart={canDrag ? () => handleDragStart(dateStr) : undefined}
                          onDragEnd={handleDragEnd}
                          onDragOver={canDrag ? (e) => handleDragOver(e, dateStr) : undefined}
                          onDrop={canDrag ? () => handleDrop(dateStr) : undefined}
                          className={`px-1 py-1 rounded border text-[10px] leading-tight select-none transition-all ${
                            isBeingDragged ? "opacity-30" : isPast ? "opacity-50" : ""
                          } ${canDrag ? "cursor-pointer hover:brightness-90 active:scale-95" : isPast ? "cursor-default" : ""} ${color.bg} ${color.text} ${color.border}`}
                        >
                          <div>{shift.start}</div>
                          <div className="opacity-80">{shift.end}</div>
                        </div>
                      ) : (
                        <div
                          draggable={canDrag}
                          onClick={canClick ? () => onShiftCellClick(slot.slotNumber, dateStr) : undefined}
                          onDragStart={canDrag ? () => handleDragStart(dateStr) : undefined}
                          onDragEnd={handleDragEnd}
                          onDragOver={canDrag ? (e) => handleDragOver(e, dateStr) : undefined}
                          onDrop={canDrag ? () => handleDrop(dateStr) : undefined}
                          className={`text-[10px] italic select-none transition-all ${
                            isBeingDragged ? "opacity-30" : ""
                          } ${isDropTarget ? "text-blue-500 font-medium" : "text-gray-300"} ${canClick ? "cursor-pointer hover:text-blue-400" : canDrag ? "cursor-grab hover:text-gray-400" : ""}`}
                        >
                          libre
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-center text-[10px] font-medium border-l border-gray-100 ${weekHours > 42 ? "text-red-600" : "text-gray-500"}`}>
                  {weekHours > 0 ? fmtHours(weekHours) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
