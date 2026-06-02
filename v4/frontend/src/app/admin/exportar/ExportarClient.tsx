"use client";

import { useRouter } from "next/navigation";

const MONTHS_ES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Row {
  branchNombre: string;
  branchCodigo: string;
  areaNegocio: string;
  totalWorkers: number;
  assignedCount: number;
}

interface Props {
  year: number;
  month: number;
  rows: Row[];
  totalAssigned: number;
}

export default function ExportarClient({ year, month, rows, totalAssigned }: Props) {
  const router = useRouter();

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-");
    router.push(`/admin/exportar?year=${y}&month=${m}`);
  }

  function handleExport() {
    window.open(`/api/calendars/export-masivo?year=${year}&month=${month}`, "_blank");
  }

  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    options.push({ value: `${y}-${m}`, label: `${MONTHS_ES[m]} ${y}` });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Exportación masiva RRHH</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Descarga un Excel con RUT y horarios de todos los equipos con calendario guardado.
        </p>
      </div>

      {/* Selector mes */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Mes:</label>
        <select
          value={`${year}-${month}`}
          onChange={handleMonthChange}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          No hay calendarios guardados para {MONTHS_ES[month]} {year}.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Sucursal</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Código</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Área</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Asignados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{row.branchNombre}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{row.branchCodigo}</td>
                  <td className="px-4 py-2 text-gray-500 capitalize">{row.areaNegocio}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={row.assignedCount < row.totalWorkers ? "text-amber-600 font-medium" : "text-gray-900"}>
                      {row.assignedCount}
                    </span>
                    <span className="text-gray-400 text-xs"> / {row.totalWorkers}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-gray-600">
                  {rows.length} equipo{rows.length !== 1 ? "s" : ""} con calendario
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-900">
                  {totalAssigned} filas
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Botón export */}
      {rows.length > 0 && (
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
        >
          Descargar Excel — {MONTHS_ES[month]} {year} ({totalAssigned} filas)
        </button>
      )}
    </div>
  );
}
