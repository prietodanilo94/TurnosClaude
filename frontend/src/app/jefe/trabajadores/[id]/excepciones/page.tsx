"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { databases } from "@/lib/auth/appwrite-client";
import { listExceptionsByWorker } from "@/lib/exceptions/api";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ExceptionsList } from "@/app/admin/trabajadores/[id]/excepciones/components/ExceptionsList";
import type { Worker, Branch, WorkerConstraint } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function JefeExcepcionesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authorizedBranchIds, loading: authLoading } = useCurrentUser();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [exceptions, setExceptions] = useState<WorkerConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function load() {
      try {
        const workerDoc = await databases.getDocument(DB, "workers", id);
        if (cancelled) return;
        const w = workerDoc as unknown as Worker;

        // Verificar que el worker pertenece a una sucursal autorizada
        if (!authorizedBranchIds.includes(w.branch_id)) {
          router.replace("/jefe/403");
          return;
        }

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
  }, [id, authLoading, authorizedBranchIds, router]);

  if (authLoading || loading) {
    return <div className="p-6"><p className="text-sm text-gray-500">Cargando…</p></div>;
  }

  if (error || !worker) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? "Trabajador no encontrado."}</p>
        <button
          onClick={() => router.push("/jefe")}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        ← Volver
      </button>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-base font-semibold text-gray-900">
            Excepciones de: {worker.nombre_completo} ({worker.rut})
          </h1>
          {branch && (
            <p className="text-xs text-gray-500 mt-0.5">Sucursal: {branch.nombre}</p>
          )}
          <p className="text-xs text-blue-600 mt-1">Solo lectura — contactá al administrador para modificar excepciones.</p>
        </div>

        <div className="px-5">
          <ExceptionsList exceptions={exceptions} readOnly />
        </div>
      </div>
    </div>
  );
}
