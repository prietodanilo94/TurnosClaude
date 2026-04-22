"use client";

import type { ParsedRow, ParseError } from "@/lib/excel-parser";

interface Props {
  rows: ParsedRow[];
  errors: ParseError[];
}

export function PreviewTable({ rows, errors }: Props) {
  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-red-200">
            <p className="text-sm font-medium text-red-700">
              {errors.length} fila(s) con errores — no se sincronizarán
            </p>
          </div>
          <ul className="divide-y divide-red-100">
            {errors.map((e) => (
              <li key={e.fila} className="px-4 py-2 text-xs text-red-600">
                <span className="font-medium">Fila {e.fila}:</span> {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {rows.length} trabajador(es) detectados
            </p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {["RUT", "Nombre", "Área de Negocio", "Sucursal", "Supervisor"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.rut} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.rut}</td>
                    <td className="px-4 py-2 text-gray-900">{r.nombre}</td>
                    <td className="px-4 py-2 text-gray-600">{r.areaNegocio}</td>
                    <td className="px-4 py-2 text-gray-600">
                      <span className="font-medium">{r.codigoArea}</span>
                      <span className="ml-1 text-gray-400">{r.nombreSucursal}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{r.supervisor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
