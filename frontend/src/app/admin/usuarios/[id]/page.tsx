"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { User, BranchManager } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function JefeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [jefe, setJefe] = useState<User | null>(null);
  const [sucursalesCount, setSucursalesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [userDoc, bmResult] = await Promise.all([
          databases.getDocument(DB_ID, "users", id),
          databases.listDocuments(DB_ID, "branch_managers", [
            Query.equal("user_id", id),
            Query.isNull("asignado_hasta"),
            Query.limit(100),
          ]),
        ]);
        if (cancelled) return;
        setJefe(userDoc as unknown as User);
        setSucursalesCount((bmResult.documents as unknown as BranchManager[]).length);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar el usuario.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleDesactivar() {
    setActionError(null);
    setDeactivating(true);
    try {
      const res = await fetch("/api/admin/deactivate-jefe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      router.push("/admin/usuarios");
    } catch (e: any) {
      setActionError(e.message ?? "No se pudo desactivar el usuario.");
      setDeactivating(false);
    }
  }

  if (loading) {
    return <div className="p-6"><p className="text-sm text-gray-500">Cargando…</p></div>;
  }

  if (loadError || !jefe) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{loadError ?? "Usuario no encontrado."}</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg">
      <button
        onClick={() => router.push("/admin/usuarios")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        ← Volver a usuarios
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{jefe.nombre_completo}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{jefe.email}</p>
            {jefe.rut && <p className="text-xs text-gray-400 mt-1">RUT: {jefe.rut}</p>}
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              jefe.activo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
            }`}
          >
            {jefe.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {sucursalesCount} sucursal{sucursalesCount !== 1 ? "es" : ""} asignada{sucursalesCount !== 1 ? "s" : ""}
          </p>
          <Link
            href={`/admin/usuarios/${id}/sucursales`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Gestionar sucursales →
          </Link>
        </div>
      </div>

      {jefe.activo && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-red-800 mb-1">Zona de peligro</h2>
          <p className="text-xs text-red-600 mb-3">
            Desactivar al jefe cierra su sesión, deshabilita su cuenta y quita todas las
            sucursales asignadas. Esta acción no se puede deshacer fácilmente.
          </p>

          {actionError && (
            <p className="text-xs text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 mb-3">
              {actionError}
            </p>
          )}

          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
            >
              Desactivar usuario
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-700 font-medium">¿Confirmar desactivación?</p>
              <button
                onClick={handleDesactivar}
                disabled={deactivating}
                className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivating ? "Desactivando…" : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deactivating}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
