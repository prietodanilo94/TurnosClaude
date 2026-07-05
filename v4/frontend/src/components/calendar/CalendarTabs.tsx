"use client";

import { useState } from "react";

interface Props {
  // "libre" si el calendario guardado del mes es de horario libre; null si
  // es rotativo o no hay calendario. La pestana del tipo guardado aparece
  // primera y activa.
  savedOrigen: "libre" | null;
  hasCalendar: boolean;
  rotativo: React.ReactNode;
  libre: React.ReactNode;
}

// Pestanas Horario rotativo | Horario libre (F11). Ambos contenidos quedan
// montados (la inactiva se oculta con CSS) para no perder trabajo sin
// guardar al explorar la otra pestana.
export default function CalendarTabs({ savedOrigen, hasCalendar, rotativo, libre }: Props) {
  const officialTab: "rotativo" | "libre" = savedOrigen === "libre" ? "libre" : "rotativo";
  const [tab, setTab] = useState<"rotativo" | "libre">(officialTab);

  const tabs: { id: "rotativo" | "libre"; label: string }[] =
    officialTab === "libre"
      ? [{ id: "libre", label: "Horario libre" }, { id: "rotativo", label: "Horario rotativo" }]
      : [{ id: "rotativo", label: "Horario rotativo" }, { id: "libre", label: "Horario libre" }];

  return (
    <div>
      <div className="px-6 pt-4 flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t-lg border border-b-0 transition-colors ${
              tab === t.id
                ? "bg-white border-gray-300 text-gray-900 font-medium"
                : "bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {hasCalendar && officialTab === t.id && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 align-middle">oficial</span>
            )}
          </button>
        ))}
      </div>
      <div className={tab === "rotativo" ? "" : "hidden"}>{rotativo}</div>
      <div className={tab === "libre" ? "" : "hidden"}>{libre}</div>
    </div>
  );
}
