import { CalendarPageClient } from "./CalendarPageClient";

interface PageProps {
  params: { branchId: string; year: string; month: string };
}

export default function CalendarPage({ params }: PageProps) {
  const { branchId, year: yearStr, month: monthStr } = params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return <div className="p-6 text-red-600">Parametros de URL invalidos.</div>;
  }

  return <CalendarPageClient branchId={branchId} year={year} month={month} />;
}
