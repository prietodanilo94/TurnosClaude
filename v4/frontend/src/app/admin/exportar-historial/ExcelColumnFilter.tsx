"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  values: string[]; // valores disponibles, ya calculados en cascada por el padre
  selected: Set<string> | null; // null = todos
  onChange: (next: Set<string> | null) => void;
  emptyLabel?: string; // como mostrar el valor ""
}

// Desplegable estilo Excel: checklist de valores unicos + buscador interno +
// marcar todos/ninguno. El padre es dueno del estado de seleccion; este
// componente solo pinta la UI y calcula que subconjunto de `values` matchea
// el texto buscado.
export default function ExcelColumnFilter({ values, selected, onChange, emptyLabel = "(vacío)" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const isActive = selected !== null && selected.size < values.length;
  const term = search.trim().toLowerCase();
  const visibleValues = term
    ? values.filter((v) => (v || emptyLabel).toLowerCase().includes(term))
    : values;

  function toggleValue(v: string) {
    const base = selected ?? new Set(values);
    const next = new Set(base);
    if (next.has(v)) next.delete(v); else next.add(v);
    // Si quedan seleccionados todos los valores conocidos, equivale a "sin filtro"
    onChange(next.size >= values.length ? null : next);
  }

  function selectAll() {
    onChange(null);
  }

  function selectNone() {
    onChange(new Set());
  }

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filtrar"
        className={`ml-1 px-1 rounded text-[10px] leading-none ${isActive ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600"}`}
      >
        ▾
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg p-2 normal-case font-normal text-gray-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-xs"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mb-2 text-[11px]">
            <button type="button" onClick={selectAll} className="text-blue-600 hover:underline">Todos</button>
            <span className="text-gray-300">·</span>
            <button type="button" onClick={selectNone} className="text-blue-600 hover:underline">Ninguno</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {visibleValues.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-1">Sin coincidencias</p>
            ) : (
              visibleValues.map((v) => {
                const checked = selected === null || selected.has(v);
                return (
                  <label key={v || "__empty__"} className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(v)}
                      className="w-3.5 h-3.5 rounded border-gray-300"
                    />
                    <span className="truncate">{v || emptyLabel}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </span>
  );
}
