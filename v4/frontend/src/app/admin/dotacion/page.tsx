"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { DotacionDiff } from "@/lib/dotacion/diff";

interface SyncResult {
  branchesCreated: number;
  branchesUpdated: number;
  workersUpserted: number;
  workersDeactivated: number;
  errors: { fila: number; motivo: string }[];
}

interface PreviewData {
  fileName: string;
  rowCount: number;
  branchCount: number;
  errors: { fila: number; motivo: string }[];
  diff: DotacionDiff;
}

export default function DotacionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
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

  function reset() {
    setPreview(null);
    setFileBuffer(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dotación</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Sube el Excel con los vendedores para actualizar la dotación
        </p>
      </div>

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

      {loading && <p className="text-sm text-gray-500 mt-4">Procesando…</p>}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-800 mb-2">{preview.fileName}</p>
            <div className="flex gap-6 text-sm text-gray-600">
              <span><strong>{preview.rowCount}</strong> vendedores en archivo</span>
              <span><strong>{preview.branchCount}</strong> sucursales</span>
              {preview.errors.length > 0 && (
                <span className="text-orange-600">
                  <strong>{preview.errors.length}</strong> filas con error
                </span>
              )}
            </div>
          </div>

          <DiffSummary diff={preview.diff} />

          {preview.errors.length > 0 && (
            <details className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <summary className="text-xs font-medium text-orange-800 cursor-pointer">
                {preview.errors.length} filas con errores (se omitirán)
              </summary>
              <ul className="space-y-1 mt-2">
                {preview.errors.map((err, i) => (
                  <li key={i} className="text-xs text-orange-700">
                    Fila {err.fila}: {err.motivo}
                  </li>
                ))}
              </ul>
            </details>
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
              onClick={reset}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 mb-2">Sincronización completada</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
              <span>Sucursales creadas: <strong>{result.branchesCreated}</strong></span>
              <span>Sucursales actualizadas: <strong>{result.branchesUpdated}</strong></span>
              <span>Vendedores actualizados: <strong>{result.workersUpserted}</strong></span>
              <span>Vendedores desactivados: <strong>{result.workersDeactivated}</strong></span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <details className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <summary className="text-xs font-medium text-orange-800 cursor-pointer">
                {result.errors.length} filas omitidas
              </summary>
              <ul className="space-y-1 mt-2">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-orange-700">
                    Fila {err.fila}: {err.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-3">
            <Link
              href="/admin/sucursales"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Ir a Sucursales →
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
            >
              Subir otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffSummary({ diff }: { diff: DotacionDiff }) {
  const total =
    diff.nuevos.length + diff.modificados.length + diff.desactivar.length + diff.sucursalesNuevas.length;

  if (total === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        No hay cambios respecto a la dotación actual ({diff.sinCambios} vendedores sin cambios).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill color="blue" label={`${diff.nuevos.length} nuevos`} />
        <Pill color="amber" label={`${diff.modificados.length} modificados`} />
        <Pill color="rose" label={`${diff.desactivar.length} a desactivar`} />
        <Pill color="violet" label={`${diff.sucursalesNuevas.length} sucursales nuevas`} />
        <Pill color="gray" label={`${diff.sinCambios} sin cambios`} />
      </div>

      {diff.sucursalesNuevas.length > 0 && (
        <DiffSection title="Sucursales nuevas" tone="violet">
          <ul className="divide-y divide-violet-100">
            {diff.sucursalesNuevas.map((s) => (
              <li key={s.codigo} className="py-1.5 px-3 text-xs flex justify-between">
                <span className="text-violet-900 font-medium">{s.nombre}</span>
                <span className="text-violet-700">
                  {s.codigo} — {s.vendedoresCount} vendedor{s.vendedoresCount !== 1 ? "es" : ""}
                </span>
              </li>
            ))}
          </ul>
        </DiffSection>
      )}

      {diff.nuevos.length > 0 && (
        <DiffSection title="Vendedores nuevos" tone="blue">
          <ul className="divide-y divide-blue-100">
            {diff.nuevos.map((v) => (
              <li key={v.rut} className="py-1.5 px-3 text-xs flex justify-between gap-2">
                <span className="text-blue-900 font-medium truncate">{v.nombre}</span>
                <span className="text-blue-700 shrink-0">
                  {v.sucursal} · {v.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                </span>
              </li>
            ))}
          </ul>
        </DiffSection>
      )}

      {diff.modificados.length > 0 && (
        <DiffSection title="Vendedores modificados" tone="amber">
          <ul className="divide-y divide-amber-100">
            {diff.modificados.map((v) => (
              <li key={v.rut} className="py-1.5 px-3 text-xs">
                <p className="text-amber-900 font-medium">{v.nombre} <span className="text-amber-600 font-normal">{v.rut}</span></p>
                <ul className="mt-0.5 space-y-0.5">
                  {v.cambios.map((c, i) => (
                    <li key={i} className="text-amber-700">
                      {labelCampo(c.campo)}: <span className="line-through opacity-60">{c.antes}</span> → <span className="font-medium">{c.ahora}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </DiffSection>
      )}

      {diff.desactivar.length > 0 && (
        <DiffSection title="Vendedores a desactivar" tone="rose">
          <ul className="divide-y divide-rose-100">
            {diff.desactivar.map((v) => (
              <li key={v.rut} className="py-1.5 px-3 text-xs flex justify-between gap-2">
                <span className="text-rose-900 font-medium truncate">{v.nombre}</span>
                <span className="text-rose-700 shrink-0">
                  {v.sucursal} · {v.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                </span>
              </li>
            ))}
          </ul>
        </DiffSection>
      )}
    </div>
  );
}

function labelCampo(c: "nombre" | "sucursal" | "areaNegocio"): string {
  if (c === "nombre") return "Nombre";
  if (c === "sucursal") return "Sucursal";
  return "Área de negocio";
}

function Pill({ color, label }: { color: "blue" | "amber" | "rose" | "violet" | "gray"; label: string }) {
  const styles: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    violet: "bg-violet-100 text-violet-800",
    gray: "bg-gray-100 text-gray-700",
  };
  return <span className={`px-2 py-0.5 rounded-full font-medium ${styles[color]}`}>{label}</span>;
}

function DiffSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "blue" | "amber" | "rose" | "violet";
  children: React.ReactNode;
}) {
  const tones: Record<string, { bg: string; border: string; head: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", head: "text-blue-900" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", head: "text-amber-900" },
    rose: { bg: "bg-rose-50", border: "border-rose-200", head: "text-rose-900" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", head: "text-violet-900" },
  };
  const t = tones[tone];
  return (
    <details open className={`${t.bg} border ${t.border} rounded-lg overflow-hidden`}>
      <summary className={`px-3 py-2 text-xs font-medium ${t.head} cursor-pointer`}>
        {title}
      </summary>
      {children}
    </details>
  );
}
