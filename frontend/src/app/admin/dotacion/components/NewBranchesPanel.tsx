"use client";

import type { BranchDiff } from "@/types/dotacion-sync";
import type { TipoFranja } from "@/types/models";

const TIPOS: { value: TipoFranja; label: string }[] = [
  { value: "standalone", label: "Standalone" },
  { value: "autopark",   label: "Autopark" },
  { value: "movicenter", label: "Movicenter" },
  { value: "tqaoev",     label: "TQAOEV" },
  { value: "sur",        label: "Sur" },
];

interface Props {
  branches: BranchDiff[];
  onTipoChange: (codigoArea: string, tipo: TipoFranja) => void;
}

export function NewBranchesPanel({ branches, onTipoChange }: Props) {
  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
        <p className="text-sm font-medium text-amber-800">
          {branches.length} sucursal(es) nueva(s) — asigná el tipo antes de continuar
        </p>
      </div>
      <ul className="divide-y divide-amber-100">
        {branches.map((b) => (
          <li key={b.codigoArea} className="px-4 py-3 flex items-center gap-4 bg-white">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{b.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{b.codigoArea} · {b.workerCount} trabajador(es)</p>
            </div>
            <select
              value={b.tipoFranja ?? ""}
              onChange={(e) => onTipoChange(b.codigoArea, e.target.value as TipoFranja)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Seleccionar tipo…</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {!b.tipoFranja && (
              <span className="text-xs text-red-500 shrink-0">Requerido</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
