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
}

function statusClass(hours: number, max: number): string {
  if (hours > max) return "text-red-600 font-semibold";
  if (hours >= max * 0.95) return "text-amber-600 font-medium";
  return "text-emerald-700";
}

function statusIcon(hours: number, max: number): string {
  if (hours > max) return "⚠";
  if (hours >= max * 0.95) return "~";
  return "✓";
}

export function WeekHoursSummary({
  isoWeek,
  hoursByWorker,
  workers,
  slotByRut,
  maxHours,
}: WeekHoursSummaryProps) {
  const entries = Object.entries(hoursByWorker)
    .filter(([, h]) => h > 0)
    .sort((a, b) => (slotByRut[a[0]] ?? 99) - (slotByRut[b[0]] ?? 99));

  return (
    <div className="w-28 shrink-0 bg-white border border-gray-200 rounded-md p-2 text-xs space-y-1">
      <div className="text-gray-400 font-medium mb-1">Sem {isoWeek}</div>
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
          return (
            <div key={rut} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.bg} border ${color.border}`} />
              <span className="truncate text-gray-600 flex-1">{shortName}</span>
              <span className={statusClass(hours, maxHours)}>
                {hours.toFixed(0)}h {statusIcon(hours, maxHours)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
