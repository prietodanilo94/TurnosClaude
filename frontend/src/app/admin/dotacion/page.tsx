"use client";

import { useState } from "react";
import { ExcelDropZone } from "./components/ExcelDropZone";
import { PreviewTable } from "./components/PreviewTable";
import { NewBranchesPanel } from "./components/NewBranchesPanel";
import { SyncConfirmDialog } from "./components/SyncConfirmDialog";
import { parseDotacionExcel } from "@/lib/excel-parser";
import { computeDiff } from "@/lib/compute-diff";
import type { ParsedRow, ParseError, DotacionDiff, BranchDiff } from "@/types/dotacion-sync";

type Stage = "idle" | "parsed" | "diffed" | "syncing" | "done";

export default function DotacionPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [parsing, setParsing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [diff, setDiff] = useState<DotacionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);

  async function handleFile(file: File) {
    setParsing(true);
    setPageError(null);
    setRows([]);
    setParseErrors([]);
    setDiff(null);
    setFileName(file.name);
    setStage("idle");

    try {
      const result = await parseDotacionExcel(file);
      setRows(result.rows);
      setParseErrors(result.errors);
      if (result.rows.length > 0) setStage("parsed");
    } catch (e: any) {
      setPageError(e.message ?? "Error al leer el archivo");
    } finally {
      setParsing(false);
    }
  }

  async function handleComputeDiff() {
    setDiffLoading(true);
    setPageError(null);
    try {
      const result = await computeDiff(rows);
      setDiff(result);
      setStage("diffed");
    } catch (e: any) {
      setPageError(e.message ?? "Error al consultar Appwrite");
    } finally {
      setDiffLoading(false);
    }
  }

  function handleBranchTypeChange(codigoArea: string, tipo: BranchDiff["tipoFranja"]) {
    setDiff((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        branches: prev.branches.map((b) =>
          b.codigoArea === codigoArea ? { ...b, tipoFranja: tipo } : b
        ),
      };
    });
  }

  const newBranchesReady =
    diff?.branches.filter((b) => b.isNew).every((b) => b.tipoFranja) ?? true;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dotación</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Subí el Excel de dotación activa para sincronizar sucursales y trabajadores.
        </p>
      </div>

      <ExcelDropZone onFile={handleFile} loading={parsing} />

      {pageError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {pageError}
        </div>
      )}

      {(rows.length > 0 || parseErrors.length > 0) && (
        <div className="mt-6 space-y-4">
          <p className="text-xs text-gray-400">
            Archivo: <span className="font-medium text-gray-600">{fileName}</span>
          </p>
          <PreviewTable rows={rows} errors={parseErrors} />

          {stage === "parsed" && (
            <button
              onClick={handleComputeDiff}
              disabled={diffLoading}
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {diffLoading ? "Consultando Appwrite…" : "Analizar cambios"}
            </button>
          )}
        </div>
      )}

      {diff && stage === "diffed" && (
        <div className="mt-6 space-y-4">
          {diff.branches.some((b) => b.isNew) && (
            <NewBranchesPanel
              branches={diff.branches.filter((b) => b.isNew)}
              onTipoChange={handleBranchTypeChange}
            />
          )}

          <div className="flex items-center gap-4 pt-2">
            <div className="text-sm text-gray-600 space-x-4">
              <span className="text-green-700 font-medium">+{diff.workers.filter((w) => w.status === "nuevo").length} nuevos</span>
              <span className="text-blue-700 font-medium">↺ {diff.workers.filter((w) => w.status === "actualizado").length} actualizados</span>
              <span className="text-gray-400">{diff.workers.filter((w) => w.status === "sin_cambios").length} sin cambios</span>
              <span className="text-red-600 font-medium">✕ {diff.toDeactivate.length} a desactivar</span>
            </div>
            <button
              onClick={() => setShowDialog(true)}
              disabled={!newBranchesReady}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              Confirmar sincronización
            </button>
          </div>
        </div>
      )}

      {showDialog && diff && (
        <SyncConfirmDialog
          diff={diff}
          rows={rows}
          onClose={() => setShowDialog(false)}
          onDone={() => { setShowDialog(false); setStage("done"); }}
        />
      )}

      {stage === "done" && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          ✅ Sincronización completada. Podés subir otro archivo o cerrar esta página.
        </div>
      )}
    </div>
  );
}
