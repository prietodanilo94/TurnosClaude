"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { databases } from "@/lib/auth/appwrite-client";
import { listExceptionsByWorker } from "@/lib/exceptions/api";
import { ExceptionsList } from "./components/ExceptionsList";
import { NewExceptionDialog } from "./components/NewExceptionDialog";
import type { Worker, Branch, WorkerConstraint } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function ExcepcionesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [exceptions, setExceptions] = useState<WorkerConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadExceptions = useCallback(async () => {
    const excs = await listExceptionsByWorker(id);
    setExceptions(excs);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const workerDoc = await databases.getDocument(DB, "workers", id);
        if (cancelled) return;
        const w = workerDoc as unknown as Worker;
        setWorker(w);

        const [branchDoc, excs] = await Promise.all([
          databases.getDocument(DB, "branches", w.branch_id),
          listExceptionsByWorker(id),
        ]);
        if (cancelled) return;
        setBranch(branchDoc as unknown as Branch);
        setExceptions(excs);
      } catch {
        if (!cancelled) setError("No se pudo cargar la información del trabajador.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="p-6"><p className="text-sm text-gray-500">Cargando…</p></div>;
  }

  if (error || !worker) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? "Trabajador no encontrado."}</p>
        <button
          onClick={() => router.push("/admin/trabajadores")}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          Volver a trabajadores
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => router.push(`/admin/trabajadores/${id}`)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        ← Volver a ficha
      </button>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Excepciones de: {worker.nombre_completo} ({worker.rut})
            </h1>
            {branch && (
              <p className="text-xs text-gray-500 mt-0.5">Sucursal: {branch.nombre}</p>
            )}
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Nueva excepción
          </button>
        </div>

        <div className="px-5">
          <ExceptionsList exceptions={exceptions} />
        </div>
      </div>

      {dialogOpen && worker && (
        <NewExceptionDialog
          workerId={id}
          existing={exceptions}
          onCreated={loadExceptions}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
