"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface Props {
  year: number;
  month: number;
}

export default function PeriodSelector({ year, month }: Props) {
  const router      = useRouter();
  const searchParams = useSearchParams();

  function navigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year",  String(newYear));
    params.set("month", String(newMonth));
    router.push(`/supervisor/calendario?${params.toString()}`);
  }

  function prevMonth() {
    if (month === 1) navigate(year - 1, 12);
    else navigate(year, month - 1);
  }

  function nextMonth() {
    if (month === 12) navigate(year + 1, 1);
    else navigate(year, month + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={prevMonth} className="px-2 py-1 text-gray-500 hover:text-gray-800 text-sm">‹</button>
      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button onClick={nextMonth} className="px-2 py-1 text-gray-500 hover:text-gray-800 text-sm">›</button>
    </div>
  );
}
