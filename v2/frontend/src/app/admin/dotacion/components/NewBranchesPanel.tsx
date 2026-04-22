"use client";

import type { BranchDiffInfo as BranchDiff } from "@/lib/compute-diff";
import type { TipoFranja, Clasificacion } from "@/types/models";

const TIPOS: { value: TipoFranja; label: string }[] = [
  { value: "standalone", label: "Standalone" },
  { value: "autopark",   label: "Autopark" },
  { value: "movicenter", label: "Movicenter" },
  { value: "tqaoev",     label: "TQAOEV / Vespucio / Egaña" },
  { value: "sur",        label: "Sur" },
];

const CLASIFICACIONES: { value: Clasificacion; label: string }[] = [
  { value: "standalone", label: "Standalone (Lun-Sab)" },
  { value: "mall_sin_dom", label: "Mall (Sin Dom)" },
  { value: "mall_7d", label: "Mall 7 Días" },
  { value: "mall_autopark", label: "Autopark" }
];

interface Props {
  branches: BranchDiff[];
  onChange: (codigoArea: string, tipo: TipoFranja, clasif: Clasificacion) => void;
}

export function NewBranchesPanel({ branches, onChange }: Props) {
  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
        <p className="text-sm font-medium text-amber-800">
          {branches.length} sucursal(es) sin clasificar
        </p>
        <p className="text-xs text-amber-600 mt-0.5">
          Asigná los valores solo a las que querés activar ahora.
        </p>
      </div>
      <ul className="divide-y divide-amber-100">
        {branches.map((b) => (
          <li key={b.codigoArea} className="px-4 py-3 flex lg:items-center gap-4 bg-white flex-col lg:flex-row">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{b.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{b.codigoArea} · {b.workerCount} trabajador(es)</p>
            </div>
            <div className="flex gap-2">
              <select
                value={b.tipoFranja ?? ""}
                onChange={(e) => onChange(b.codigoArea, e.target.value as TipoFranja, b.clasificacion as Clasificacion)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Franja horaria…</option>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={b.clasificacion ?? ""}
                onChange={(e) => onChange(b.codigoArea, b.tipoFranja as TipoFranja, e.target.value as Clasificacion)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Clasificación…</option>
                {CLASIFICACIONES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            {(!b.tipoFranja || !b.clasificacion) && (
              <span className="text-xs text-gray-400 shrink-0">Incompleto</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
