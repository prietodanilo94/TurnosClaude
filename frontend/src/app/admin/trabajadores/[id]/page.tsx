"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { databases } from "@/lib/auth/appwrite-client";
import type { Worker, Branch } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default function TrabajadorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const workerDoc = await databases.getDocument(DB, "workers", id);
        if (cancelled) return;
        const w = workerDoc as unknown as Worker;
        setWorker(w);
        const branchDoc = await databases.getDocument(DB, "branches", w.branch_id);
        if (!cancelled) setBranch(branchDoc as unknown as Branch);
      } catch {
        if (!cancelled) setError("No se pudo cargar el trabajador.");
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
    <div className="p-6 max-w-lg">
      <button
        onClick={() => router.push("/admin/trabajadores")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        ← Volver a trabajadores
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">{worker.nombre_completo}</h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              worker.activo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
            }`}
          >
            {worker.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <Field label="RUT" value={worker.rut} />
          <Field label="Sucursal" value={branch?.nombre ?? worker.branch_id} />
          <Field label="Supervisor" value={worker.supervisor_nombre ?? "—"} />
          <Field
            label="Última sync Excel"
            value={
              worker.ultima_sync_excel
                ? new Date(worker.ultima_sync_excel).toLocaleDateString("es-CL")
                : "—"
            }
          />
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Excepciones</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Días prohibidos, turnos prohibidos y vacaciones
            </p>
          </div>
          <Link
            href={`/admin/trabajadores/${id}/excepciones`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Gestionar excepciones →
          </Link>
        </div>
      </div>
    </div>
  );
}
