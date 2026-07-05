"use client";

import { useState } from "react";

interface Props {
  // "libre" si el calendario guardado del mes es de horario libre; null si
  // es rotativo o no hay calendario. El modo del tipo guardado se muestra
  // por defecto.
  savedOrigen: "libre" | null;
  hasCalendar: boolean;
  rotativo: React.ReactNode;
  libre: React.ReactNode;
}

// Alternador Horario rotativo <-> Horario libre (F11). En vez de pestanas,
// un boton contextual: "Crea tu horario" para pasar al modo libre y "Crear
// horario rotativo" para volver al rotativo. Ambos contenidos quedan
// montados (el inactivo se oculta con CSS) para no perder trabajo sin
// guardar al alternar.
export default function CalendarTabs({ savedOrigen, hasCalendar, rotativo, libre }: Props) {
  const officialMode: "rotativo" | "libre" = savedOrigen === "libre" ? "libre" : "rotativo";
  const [mode, setMode] = useState<"rotativo" | "libre">(officialMode);

  const buttonLabel =
    mode === "rotativo"
      ? officialMode === "libre" ? "← Volver al horario libre" : "✏️ Crea tu horario"
      : officialMode === "libre" ? "Crear horario rotativo" : "← Volver al horario rotativo";

  return (
    <div>
      <div className="px-6 pt-4 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-gray-500">
          {hasCalendar ? (
            <>
              Horario oficial de este mes:{" "}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                officialMode === "libre" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
              }`}>
                {officialMode === "libre" ? "Horario libre" : "Horario rotativo"}
              </span>
              {mode !== officialMode && (
                <span className="ml-2 text-amber-600">Estás viendo un borrador {mode === "libre" ? "libre" : "rotativo"} — es oficial solo si lo guardas.</span>
              )}
            </>
          ) : (
            <>Este mes aún no tiene horario guardado.</>
          )}
        </span>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "rotativo" ? "libre" : "rotativo"))}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            mode === "rotativo"
              ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
      <div className={mode === "rotativo" ? "" : "hidden"}>{rotativo}</div>
      <div className={mode === "libre" ? "" : "hidden"}>{libre}</div>
    </div>
  );
}
