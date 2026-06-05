"use client";

import { workerColor } from "@/components/calendar/worker-colors";
import type { CalendarSlot } from "@/types";
import { isWorkerBlockedOnDate, type WorkerBlockDateMap } from "@/lib/calendar/generator";
import {
  DOW_LABELS, dowIndex, fmtHours, isFeriadoIrrenunciable, minutesFromTime,
  shiftDuration, shortWorkerName, type AttendanceByRut,
} from "./calendar-utils";

export interface GanttInlineProps {
  dateStr: string;
  slots: CalendarSlot[];
  assign: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap: WorkerBlockDateMap;
  slotDisplayNum: Record<number, number>;
  workerRutMap?: Record<string, string>;
  attendanceByRut?: AttendanceByRut;
}

export function GanttInline({ dateStr, slots, assign, workerMap, blockMap, slotDisplayNum, workerRutMap = {}, attendanceByRut = {} }: GanttInlineProps) {
  const date = new Date(dateStr + "T12:00:00");
  const feriado = isFeriadoIrrenunciable(date);

  const activeSlots = slots
    .map((slot) => {
      const workerId = assign[String(slot.slotNumber)] ?? null;
      const shift = slot.days[dateStr] ?? null;
      const rut = workerId ? (workerRutMap[workerId] ?? null) : null;
      const att = rut ? (attendanceByRut[rut]?.[dateStr] ?? null) : null;
      return { slot, shift, workerId, att };
    })
    .filter(({ shift, workerId }) => shift !== null && !feriado && !isWorkerBlockedOnDate(blockMap, workerId, dateStr));

  if (activeSlots.length === 0) {
    return (
      <div className="px-4 py-3 bg-blue-50/40 text-xs text-gray-400 italic text-center">
        {feriado ? "Feriado irrenunciable" : "Sin turnos asignados este día"}
      </div>
    );
  }

  const allTimeMins = [
    ...activeSlots.map(({ shift }) => minutesFromTime(shift!.start)),
    ...activeSlots.map(({ shift }) => minutesFromTime(shift!.end)),
    ...activeSlots.flatMap(({ att }) => [
      att?.entrada ? minutesFromTime(att.entrada) : null,
      att?.salida  ? minutesFromTime(att.salida)  : null,
    ]).filter((v): v is number => v !== null),
  ];
  const axisStart = Math.floor(Math.min(...allTimeMins) / 60) * 60;
  const axisEnd   = Math.ceil(Math.max(...allTimeMins) / 60) * 60;
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
        {activeSlots.map(({ slot, shift, workerId, att }) => {
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
              <div className="flex-1 relative h-8 bg-white rounded border border-gray-200">
                {hourMarks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}
                <div
                  className={`absolute top-1 bottom-1 rounded ${color.bg} ${color.border} border flex items-center justify-center overflow-hidden`}
                  style={{
                    left:  `${pct(startMin)}%`,
                    width: `${pct(endMin) - pct(startMin)}%`,
                  }}
                >
                  <span className={`text-[11px] font-medium ${color.text} px-1 truncate`}>
                    {shift!.start}–{shift!.end}
                  </span>
                </div>
                {[
                  { time: att?.entrada ?? null, isEntry: true  },
                  { time: att?.salida  ?? null, isEntry: false },
                ].map(({ time, isEntry }) => {
                  if (!time) return null;
                  const pos = Math.max(0, Math.min(100, pct(minutesFromTime(time))));
                  return (
                    <div
                      key={isEntry ? "in" : "out"}
                      className="absolute top-0 bottom-0 flex flex-col items-center z-20 pointer-events-none"
                      style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                    >
                      <span className={`text-xs font-bold leading-none mt-0.5 whitespace-nowrap bg-white/95 border rounded px-0.5 ${
                        isEntry ? "text-emerald-700 border-emerald-300" : "text-orange-600 border-orange-300"
                      }`}>
                        {time}
                      </span>
                      <div className={`flex-1 w-px ${isEntry ? "bg-emerald-500" : "bg-orange-500"}`} />
                      <div className={`w-2 h-2 rounded-full border-2 border-white shadow-sm shrink-0 mb-0.5 ${
                        isEntry ? "bg-emerald-500" : "bg-orange-500"
                      }`} />
                    </div>
                  );
                })}
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
