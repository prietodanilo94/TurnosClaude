"use client";

import { useState } from "react";
import { ExcelDropZone } from "./components/ExcelDropZone";
import { PreviewTable } from "./components/PreviewTable";
import { parseDotacionExcel } from "@/lib/excel-parser";
import type { ParsedRow, ParseError } from "@/types/dotacion-sync";

export default function DotacionPage() {
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setRows([]);
    setErrors([]);
    setFileName(file.name);

    try {
      const result = await parseDotacionExcel(file);
      setRows(result.rows);
      setErrors(result.errors);
    } catch (e: any) {
      setParseError(e.message ?? "Error al leer el archivo");
    } finally {
      setParsing(false);
    }
  }

  const hasResults = rows.length > 0 || errors.length > 0;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dotación</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Subí el Excel de dotación activa para sincronizar sucursales y trabajadores.
        </p>
      </div>

      <ExcelDropZone onFile={handleFile} loading={parsing} />

      {parseError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {parseError}
        </div>
      )}

      {hasResults && (
        <div className="mt-6 space-y-2">
          <p className="text-xs text-gray-400">
            Archivo: <span className="font-medium text-gray-600">{fileName}</span>
          </p>
          <PreviewTable rows={rows} errors={errors} />
        </div>
      )}
    </div>
  );
}
