"use client";

import { useCalendarStore } from "@/store/calendar-store";
import { MonthGrid } from "./MonthGrid";
import type { CalendarAssignment } from "@/types/optimizer";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function CalendarView() {
  const {
    year, month, assignments, workers, shiftCatalog,
    holidays, franjaPorDia, violations, availableProposals, activeProposalId,
  } = useCalendarStore();

  const activeProposal = availableProposals.find((p) => p.id === activeProposalId);

  function handleSlotClick(a: CalendarAssignment) {
    // Task 11 — WorkerAssignDialog lo implementará
    console.log("slot click", a);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {MONTH_NAMES[month]} {year}
          </h1>
          {activeProposal && (
            <p className="text-sm text-gray-500">
              Propuesta: {activeProposal.modo.toUpperCase()} #{activeProposalId?.split("_").pop()} — score {activeProposal.score.toFixed(1)}
            </p>
          )}
        </div>

        {violations.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <span className="text-red-600 font-medium text-sm">
              {violations.length} violación{violations.length !== 1 ? "es" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Grid del mes */}
      <MonthGrid
        year={year}
        month={month}
        franjaPorDia={franjaPorDia}
        holidays={holidays}
        assignments={assignments}
        workers={workers}
        shifts={shiftCatalog}
        violations={violations}
        maxHours={42}
        onSlotClick={handleSlotClick}
      />
    </div>
  );
}
