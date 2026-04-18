import { CompareClient } from "./CompareClient";

interface PageProps {
  params: { branchId: string; year: string; month: string };
}

export default async function ComparePage({ params }: PageProps) {
  const { branchId, year: yearStr, month: monthStr } = params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return <div className="p-6 text-red-600">Parámetros de URL inválidos.</div>;
  }

  return <CompareClient branchId={branchId} year={year} month={month} />;
}
