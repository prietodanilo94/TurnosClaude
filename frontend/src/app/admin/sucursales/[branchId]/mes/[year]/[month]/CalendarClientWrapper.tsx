"use client";

import { useEffect } from "react";
import { useCalendarStore } from "@/store/calendar-store";
import { CalendarView } from "@/components/calendar/CalendarView";
import type { OptimizerProposal, ShiftDef } from "@/types/optimizer";
import type { Worker } from "@/types/models";

interface CalendarClientWrapperProps {
  branchId: string;
  year: number;
  month: number;
  proposals: OptimizerProposal[];
  workers: Worker[];
  shiftCatalog: ShiftDef[];
  holidays: string[];
  franjaPorDia: Record<string, { apertura: string; cierre: string } | null>;
}

export function CalendarClientWrapper({
  branchId, year, month, proposals, workers, shiftCatalog, holidays, franjaPorDia,
}: CalendarClientWrapperProps) {
  const init = useCalendarStore((s) => s.init);

  useEffect(() => {
    init({ branchId, year, month, proposals, workers, shiftCatalog, holidays, franjaPorDia });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, year, month]);

  return <CalendarView />;
}
