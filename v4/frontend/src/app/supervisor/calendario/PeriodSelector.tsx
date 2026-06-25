"use client";

import { useRouter, useSearchParams } from "next/navigation";
import MonthNavigator from "@/components/ui/MonthNavigator";

interface Props {
  year: number;
  month: number;
}

export default function PeriodSelector({ year, month }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  function handleNavigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year",  String(newYear));
    params.set("month", String(newMonth));
    router.push(`/supervisor/calendario?${params.toString()}`);
  }

  return <MonthNavigator year={year} month={month} onNavigate={handleNavigate} />;
}
