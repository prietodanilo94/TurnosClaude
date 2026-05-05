"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { buildWorkerBlockDateMap, getWorkerBlockReason } from "@/lib/calendar/generator";
import type { CalendarSlot, DayShift, WorkerBlockInfo } from "@/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_ABBR = [
  "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DOW_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1], [5, 1], [9, 18], [9, 19], [12, 25],
];
function isFeriado(date: Date) {
  return FERIADOS_IRRENUNCIABLES.some(([month, day]) => date.getMonth() + 1 === month && date.getDate() === day);
}

function dowIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function fmt(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDuration(shift: DayShift): number {
  const [h1, m1] = shift.start.split(":").map(Number);
  const [h2, m2] = shift.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

function fmtHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
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
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let index = 0; index < 7; index++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function fmtDateRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${String(start.getDate()).padStart(2, "0")} - ${String(end.getDate()).padStart(2, "0")} ${MONTH_ABBR[end.getMonth() + 1]}`;
  }
  return `${String(start.getDate()).padStart(2, "0")} ${MONTH_ABBR[start.getMonth() + 1]} - ${String(end.getDate()).padStart(2, "0")} ${MONTH_ABBR[end.getMonth() + 1]}`;
}

interface Props {
  workerName: string;
  branchName: string;
  areaNegocio: "ventas" | "postventa";
  year: number;
  month: number;
  slot: CalendarSlot | null;
  workerBlocks: WorkerBlockInfo[];
  teamId: string;
  calendarId?: string;
}

export default function VendedorView({
  workerName,
  branchName,
  areaNegocio,
  year,
  month,
  slot,
  workerBlocks,
  teamId,
  calendarId,
}: Props) {
  const router = useRouter();
  const weeks = buildIsoWeeks(year, month);
  const blockMap = useMemo(() => buildWorkerBlockDateMap(workerBlocks), [workerBlocks]);

  function navigate(newYear: number, newMonth: number) {
    router.push(`/vendedor/${newYear}/${newMonth}`);
  }

  function prevMonth() {
    const date = new Date(year, month - 2, 1);
    navigate(date.getFullYear(), date.getMonth() + 1);
  }

  function nextMonth() {
    const date = new Date(year, month, 1);
    navigate(date.getFullYear(), date.getMonth() + 1);
  }

  function handleExport() {
    if (!calendarId) return;
    window.open(`/api/calendars/export?teamId=${teamId}&year=${year}&month=${month}&mode=calendar`, "_blank");
  }

  let totalHours = 0;
  let totalDays = 0;
  if (slot) {
    for (const week of weeks) {
      for (const day of week) {
        const inMonth = day.getMonth() + 1 === month;
        if (!inMonth) continue;
        const dateStr = fmt(day);
        const shift = slot.days[dateStr] ?? null;
        const blockReason = getWorkerBlockReason(blockMap, workerBlocks[0]?.workerId ?? null, dateStr);
        if (shift && !isFeriado(day) && blockReason === null) {
          totalHours += shiftDuration(shift);
          totalDays++;
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{workerName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {branchName} · {areaNegocio === "ventas" ? "Ventas" : "Postventa"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {calendarId && (
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
            >
              Exportar
            </button>
          )}
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="px-2 py-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
              ‹
            </button>
            <span className="text-sm font-medium text-gray-800 px-2">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="px-2 py-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
              ›
            </button>
          </div>
        </div>
      </div>

      {!slot && (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-sm text-gray-500">No tienes turnos asignados en {MONTH_NAMES[month]} {year}.</p>
          <p className="text-xs text-gray-400 mt-1">Consulta con tu supervisor.</p>
        </div>
      )}

      {slot && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-blue-700 text-white flex items-center justify-between">
            <span className="text-sm font-medium">Mis turnos - {MONTH_NAMES[month]} {year}</span>
            <span className="text-xs opacity-80">
              {totalDays} dias · {fmtHours(totalHours)} mensuales
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-blue-50">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium w-10">Sem</th>
                  {DOW_LABELS.map((label, index) => (
                    <th key={index} className={`px-2 py-2 text-center text-gray-500 font-medium ${index >= 5 ? "bg-orange-50/50" : ""}`}>
                      {label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-gray-500 font-medium border-l border-gray-100">Hrs</th>
                </tr>
              </thead>
              <>
                {weeks.map((week, weekIndex) => {
                  const isoWeek = isoWeekNumber(week[0]);
                  const rangeLabel = fmtDateRange(week[0], week[6]);
                  let weekHours = 0;
                  const days = week.map((day, columnIndex) => {
                    const inMonth = day.getMonth() + 1 === month;
                    const feriado = isFeriado(day);
                    const dateStr = fmt(day);
                    const shift = slot.days[dateStr] ?? null;
                    const blockReason = getWorkerBlockReason(blockMap, workerBlocks[0]?.workerId ?? null, dateStr);
                    if (shift && !feriado && inMonth && blockReason === null) weekHours += shiftDuration(shift);
                    return { day, shift, inMonth, feriado, isWeekend: columnIndex >= 5, blockReason };
                  });

                  return (
                    <tbody key={weekIndex}>
                      <tr className="bg-blue-600/10 border-t border-blue-100">
                        <td colSpan={9} className="px-3 py-0.5 text-[10px] text-blue-600 font-semibold">
                          Sem {isoWeek} &nbsp; {rangeLabel}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-300 font-medium text-center">{isoWeek}</td>
                        {days.map(({ day, shift, inMonth, feriado, isWeekend, blockReason }, columnIndex) => (
                          <td
                            key={columnIndex}
                            className={`px-0.5 py-1.5 text-center border-l border-gray-50 ${
                              !inMonth ? "opacity-25" : ""
                            } ${feriado ? "bg-red-50" : isWeekend ? "bg-orange-50/30" : ""}`}
                          >
                            <div className="text-[9px] text-gray-300 leading-none mb-0.5">{day.getDate()}</div>
                            {feriado ? (
                              <div className="text-[8px] text-red-400 italic leading-none">fer.</div>
                            ) : blockReason !== null ? (
                              <div className="rounded text-[8px] leading-tight bg-gray-200 text-gray-700 px-0.5 py-0.5" title={blockReason || "Bloqueado"}>
                                <div>bloq.</div>
                                <div className="opacity-80">sin turno</div>
                              </div>
                            ) : shift ? (
                              <div className="rounded text-[8px] leading-tight bg-blue-100 text-blue-800 px-0.5 py-0.5 font-medium">
                                <div>{shift.start}</div>
                                <div className="opacity-70">{shift.end}</div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-200 leading-none">-</div>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center text-xs font-semibold text-gray-500 border-l border-gray-100">
                          {weekHours > 0 ? fmtHours(weekHours) : "-"}
                        </td>
                      </tr>
                    </tbody>
                  );
                })}
              </>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
