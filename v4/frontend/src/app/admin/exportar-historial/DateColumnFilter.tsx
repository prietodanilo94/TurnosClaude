"use client";

import { useRef, useState } from "react";
import type { DateRangeFilter, DownloadDateFilter } from "@/lib/rrhh/tableFilters";
import FloatingPanel from "./FloatingPanel";

interface Props {
  value: DateRangeFilter | DownloadDateFilter;
  onChange: (next: DateRangeFilter | DownloadDateFilter) => void;
  allowEmpty?: boolean; // columna 8 (fecha de descarga): permite filtrar "nunca descargado"
}

// Desplegable de rango de fechas: antes de / despues de / entre. Para la
// columna de descarga ademas ofrece "solo nunca descargados". El panel se
// renderiza en un portal (ver FloatingPanel) para no quedar cortado por el
// contenedor de la tabla.
export default function DateColumnFilter({ value, onChange, allowEmpty }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onlyEmpty = "onlyEmpty" in value ? value.onlyEmpty : false;

  const isActive = !!value.from || !!value.to || onlyEmpty;

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filtrar por fecha"
        className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded border text-sm leading-none transition-colors ${
          isActive
            ? "text-blue-700 bg-blue-100 border-blue-300"
            : "text-gray-500 bg-gray-100 border-gray-300 hover:bg-gray-200 hover:text-gray-700"
        }`}
      >
        ▼
      </button>
      <FloatingPanel anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} width={208}>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Después de</label>
            <input
              type="date"
              value={value.from ?? ""}
              onChange={(e) => onChange({ ...value, from: e.target.value || null, onlyEmpty: false } as never)}
              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Antes de</label>
            <input
              type="date"
              value={value.to ?? ""}
              onChange={(e) => onChange({ ...value, to: e.target.value || null, onlyEmpty: false } as never)}
              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          {allowEmpty && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none pt-1 border-t border-gray-100">
              <input
                type="checkbox"
                checked={onlyEmpty}
                onChange={(e) => onChange({ from: null, to: null, onlyEmpty: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              Solo nunca descargados
            </label>
          )}
          {isActive && (
            <button
              type="button"
              onClick={() => onChange({ from: null, to: null, ...(allowEmpty ? { onlyEmpty: false } : {}) } as never)}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </FloatingPanel>
    </span>
  );
}
