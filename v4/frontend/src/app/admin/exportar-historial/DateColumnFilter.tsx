"use client";

import { useEffect, useRef, useState } from "react";
import type { DateRangeFilter, DownloadDateFilter } from "@/lib/rrhh/tableFilters";

interface Props {
  value: DateRangeFilter | DownloadDateFilter;
  onChange: (next: DateRangeFilter | DownloadDateFilter) => void;
  allowEmpty?: boolean; // columna 8 (fecha de descarga): permite filtrar "nunca descargado"
}

// Desplegable de rango de fechas: antes de / despues de / entre. Para la
// columna de descarga ademas ofrece "solo nunca descargados".
export default function DateColumnFilter({ value, onChange, allowEmpty }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onlyEmpty = "onlyEmpty" in value ? value.onlyEmpty : false;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const isActive = !!value.from || !!value.to || onlyEmpty;

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filtrar por fecha"
        className={`ml-1 px-1 rounded text-[10px] leading-none ${isActive ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600"}`}
      >
        ▾
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg p-2 normal-case font-normal text-gray-700 space-y-2">
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
      )}
    </span>
  );
}
