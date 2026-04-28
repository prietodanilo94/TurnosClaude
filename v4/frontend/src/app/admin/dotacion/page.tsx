"use client";

import { useState, useRef } from "react";

interface SyncResult {
  branchesCreated: number;
  branchesUpdated: number;
  workersUpserted: number;
  workersDeactivated: number;
  errors: { fila: number; motivo: string }[];
}

export default function DotacionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{
    fileName: string;
    rowCount: number;
    branchCount: number;
    errors: { fila: number; motivo: string }[];
  } | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      setFileBuffer(buf);

      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/dotacion/preview", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al leer archivo");
        return;
      }
      const data = await res.json();
      setPreview({ fileName: file.name, ...data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!fileBuffer) return;
    setLoading(true);
    setError("");
    try {
      const blob = new Blob([fileBuffer]);
      const form = new FormData();
      form.append("file", blob, "dotacion.xlsx");
      const res = await fetch("/api/dotacion/sync", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al sincronizar");
        return;
      }
      const data: SyncResult = await res.json();
      setResult(data);
      setPreview(null);
      setFileBuffer(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dotación</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Sube el Excel con trabajadores para actualizar la dotación
        </p>
      </div>

      {/* Zona de carga */}
      {!preview && !result && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-sm text-gray-600 mb-1">
            Arrastra el archivo Excel o haz clic para seleccionar
          </p>
          <p className="text-xs text-gray-400">
            Columnas requeridas: Rut, Nombre, Área, Área de Negocio
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500 mt-4">Procesando…</p>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista previa */}
      {preview && (
        <div className="mt-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-800 mb-2">{preview.fileName}</p>
            <div className="flex gap-6 text-sm text-gray-600">
              <span><strong>{preview.rowCount}</strong> trabajadores</span>
              <span><strong>{preview.branchCount}</strong> sucursales</span>
              {preview.errors.length > 0 && (
                <span className="text-orange-600">
                  <strong>{preview.errors.length}</strong> filas con error
                </span>
              )}
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-xs font-medium text-orange-800 mb-2">Filas con errores (se omitirán):</p>
              <ul className="space-y-1">
                {preview.errors.map((err, i) => (
                  <li key={i} className="text-xs text-orange-700">
                    Fila {err.fila}: {err.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Confirmar y sincronizar
            </button>
            <button
              onClick={() => { setPreview(null); setFileBuffer(null); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-4 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 mb-2">Sincronización completada</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
              <span>Sucursales creadas: <strong>{result.branchesCreated}</strong></span>
              <span>Sucursales actualizadas: <strong>{result.branchesUpdated}</strong></span>
              <span>Trabajadores actualizados: <strong>{result.workersUpserted}</strong></span>
              <span>Trabajadores desactivados: <strong>{result.workersDeactivated}</strong></span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-xs font-medium text-orange-800 mb-2">Filas omitidas:</p>
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-orange-700">
                    Fila {err.fila}: {err.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Subir otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
