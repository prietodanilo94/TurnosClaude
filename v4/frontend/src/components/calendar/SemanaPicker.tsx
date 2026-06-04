"use client";

import { useState } from "react";
import type { WeekPattern } from "@/types";

const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const SEMANA_COLORS = [
  { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300"    },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-300"  },
  { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-300"  },
  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-300"    },
  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-300"   },
] as const;

interface Props {
  workerName: string | null;
  currentOffset: number;
  patternRotation: WeekPattern[];
  /** Semana del mes (0-based) desde donde se abrió el picker */
  weekIndex: number;
  onConfirm: (newOffset: number, scope: "month" | "fromWeek") => void;
  onClose: () => void;
}

export default function SemanaPicker({ workerName, currentOffset, patternRotation, weekIndex, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState(currentOffset);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">
            ¿En qué semana del turno rotativo debe comenzar este vendedor?
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {workerName ? `${workerName} · ` : ""}Semana {weekIndex + 1} del mes
          </p>
        </div>

        {/* Pattern table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-28 py-2 text-left" />
                {DOW_SHORT.map((d) => (
                  <th key={d} className="py-2 text-center text-gray-500 font-medium px-1 min-w-[60px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patternRotation.map((week, wi) => {
                const isSelected = selected === wi;
                const sc = SEMANA_COLORS[wi % SEMANA_COLORS.length];
                return (
                  <tr
                    key={wi}
                    onClick={() => setSelected(wi)}
                    className={`cursor-pointer transition-colors ${isSelected ? "" : "hover:bg-gray-50"}`}
                  >
                    <td className={`py-2.5 pl-3 pr-4 rounded-l text-xs font-medium border-y border-l ${
                      isSelected ? `${sc.bg} ${sc.text} ${sc.border}` : "text-gray-500 border-gray-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isSelected ? `${sc.bg} border-2 ${sc.border}` : "border border-gray-300 bg-white"
                        }`} />
                        Semana {wi + 1}
                        {wi === currentOffset && (
                          <span className="text-[9px] opacity-60 font-normal">(actual)</span>
                        )}
                      </div>
                    </td>
                    {week.map((shift, di) => (
                      <td
                        key={di}
                        className={`py-2.5 px-1 text-center border-y ${di === week.length - 1 ? "rounded-r border-r" : ""} ${
                          isSelected ? `${sc.bg} ${sc.border}` : "border-gray-100"
                        }`}
                      >
                        {shift ? (
                          <div className={isSelected ? sc.text : "text-gray-700"}>
                            <div className="font-medium">{shift.start}</div>
                            <div className="opacity-60 text-[10px]">{shift.end}</div>
                          </div>
                        ) : (
                          <span className={`italic text-[10px] ${isSelected ? sc.text + " opacity-40" : "text-gray-300"}`}>
                            libre
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          {weekIndex > 0 && (
            <button
              onClick={() => onConfirm(selected, "fromWeek")}
              title={`Mantiene las semanas anteriores y aplica S${selected + 1} desde la semana ${weekIndex + 1} hacia adelante`}
              className="px-4 py-1.5 text-sm font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              S{selected + 1} desde esta semana
            </button>
          )}
          <button
            onClick={() => onConfirm(selected, "month")}
            title={`Recalcula todo el mes comenzando la semana 1 en S${selected + 1}`}
            className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            S{selected + 1} todo el mes
          </button>
        </div>
      </div>
    </div>
  );
}
