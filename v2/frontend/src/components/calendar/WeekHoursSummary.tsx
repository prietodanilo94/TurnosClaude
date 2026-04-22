"use client";

import type { Worker } from "@/types/models";
import { workerColor } from "./worker-colors";

interface WeekHoursSummaryProps {
  isoWeek: number;
  /** { workerRut -> horas en esta semana } */
  hoursByWorker: Record<string, number>;
  workers: Worker[];
  /** slot por rut, para asignar color */
  slotByRut: Record<string, number>;
  maxHours: number;
  /** true si la semana tiene días fuera del mes (primera o última semana) */
  isPartialWeek?: boolean;
}

const TARGET = 42;

function statusInfo(
  hours: number,
  isPartial: boolean
): { icon: string; css: string } {
  if (isPartial) {
    // Semana parcial: siempre ~ en ámbar (no se puede exigir 42h)
    return { icon: "~", css: "text-amber-500 font-medium" };
  }
  if (hours > TARGET) return { icon: "⚠", css: "text-red-600 font-semibold" };
  if (hours >= TARGET) return { icon: "✓", css: "text-emerald-700 font-semibold" };
  if (hours >= TARGET * 0.92) return { icon: "~", css: "text-amber-600 font-medium" };
  return { icon: "⚠", css: "text-red-600 font-semibold" };
}

export function WeekHoursSummary({
  isoWeek,
  hoursByWorker,
  workers,
  slotByRut,
  maxHours: _maxHours,
  isPartialWeek = false,
}: WeekHoursSummaryProps) {
  const entries = Object.entries(hoursByWorker)
    .filter(([, h]) => h > 0)
    .sort((a, b) => (slotByRut[a[0]] ?? 99) - (slotByRut[b[0]] ?? 99));

  return (
    <div className="w-28 shrink-0 bg-white border border-gray-200 rounded-md p-2 text-xs space-y-1">
      <div className="text-gray-400 font-medium mb-1">
        Sem {isoWeek}{isPartialWeek && <span className="text-amber-400 ml-1">↗</span>}
      </div>
      {entries.length === 0 ? (
        <div className="text-gray-300 italic">—</div>
      ) : (
        entries.map(([rut, hours]) => {
          const worker = workers.find((w) => w.rut === rut);
          const slot = slotByRut[rut] ?? 0;
          const color = workerColor(slot);
          const shortName = worker
            ? worker.nombre_completo.split(" ")[0]
            : `T${slot}`;
          const { icon, css } = statusInfo(hours, isPartialWeek);
          return (
            <div key={rut} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.bg} border ${color.border}`} />
              <span className="truncate text-gray-600 flex-1">{shortName}</span>
              <span className={css}>
                {hours.toFixed(0)}h {icon}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
