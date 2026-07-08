"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface MasivoRow {
  area: string;
  sucursal: string;
  codigo: string;
  branchId: string;
  trabajador: string;
  rut: string;
  days: string[]; // 31 valores, "" = libre
}

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ExportarMasivoClient({ rows, year, month }: { rows: MasivoRow[]; year: number; month: number }) {
  const router = useRouter();
  const [sucursal, setSucursal] = useState("");
  const [area, setArea] = useState("");

  const sucursales = useMemo(
    () => [...new Map(rows.map((r) => [r.branchId, { id: r.branchId, label: `${r.sucursal} (${r.codigo})` }])).values()]
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [rows],
  );
  const filtered = useMemo(
    () => rows.filter((r) => (!sucursal || r.branchId === sucursal) && (!area || r.area === area)),
    [rows, sucursal, area],
  );
  const lastDay = new Date(year, month, 0).getDate();

  function nav(y: number, m: number) {
    router.push(`/admin/exportar?year=${y}&month=${m}`);
  }

  function download() {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (sucursal) params.set("branchIds", sucursal);
    window.open(`/api/rrhh/export-mes?${params}`, "_blank");
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exportar Masivo</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Toda la empresa, un mes a la vez — el archivo descargado corresponde SOLO al mes seleccionado.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={filtered.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
        >
          Descargar {sucursal ? "sucursal filtrada" : "todo el mes"} ({filtered.length})
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 flex-wrap text-sm">
        <select value={month} onChange={(e) => nav(year, Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-md">
          {MESES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => nav(Number(e.target.value), month)} className="px-2 py-1.5 border border-gray-300 rounded-md">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-gray-300">·</span>
        <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md max-w-[260px]">
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md">
          <option value="">Ambas áreas</option>
          <option value="ventas">Ventas</option>
          <option value="postventa">Postventa</option>
        </select>
        <span className="text-gray-500 ml-auto">{filtered.length} de {rows.length} trabajadores · {MESES[month]} {year}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="text-[11px] whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                {["Área", "Sucursal", "Cód.", "Trabajador", "RUT"].map((h) => (
                  <th key={h} className="text-left px-2 py-2 font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{h}</th>
                ))}
                {Array.from({ length: lastDay }, (_, i) => (
                  <th key={i} className="px-1.5 py-2 font-medium text-gray-400 text-center bg-gray-50">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5 + lastDay} className="px-4 py-8 text-center text-gray-400 text-sm">Sin calendarios para {MESES[month]} {year}.</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={`${r.rut}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1 text-gray-500 capitalize">{r.area}</td>
                  <td className="px-2 py-1 text-gray-700 max-w-[160px] truncate">{r.sucursal}</td>
                  <td className="px-2 py-1 text-gray-400">{r.codigo}</td>
                  <td className="px-2 py-1 font-medium text-gray-900 max-w-[220px] truncate">{r.trabajador}</td>
                  <td className="px-2 py-1 font-mono text-gray-500">{r.rut}</td>
                  {r.days.slice(0, lastDay).map((d, di) => (
                    <td key={di} className={`px-1.5 py-1 text-center font-mono ${d ? "text-green-800 bg-green-50" : "text-gray-300"}`}>
                      {d ? d.replace(" a ", "–") : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
