"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Query, ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { User, Branch, BranchManager } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

interface AssignedRow {
  branch: Branch;
  bmId: string;
}

export default function SucursalesJefePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [jefe, setJefe] = useState<User | null>(null);
  const [assigned, setAssigned] = useState<AssignedRow[]>([]);
  const [available, setAvailable] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [userDoc, bmResult, branchResult] = await Promise.all([
        databases.getDocument(DB_ID, "users", id),
        databases.listDocuments(DB_ID, "branch_managers", [
          Query.equal("user_id", id),
          Query.isNull("asignado_hasta"),
          Query.limit(100),
        ]),
        databases.listDocuments(DB_ID, "branches", [
          Query.equal("activa", true),
          Query.limit(100),
        ]),
      ]);

      const bms = bmResult.documents as unknown as BranchManager[];
      const allBranches = branchResult.documents as unknown as Branch[];
      const assignedIds = new Set(bms.map((bm) => bm.branch_id));

      setJefe(userDoc as unknown as User);
      setAssigned(
        bms
          .map((bm) => ({
            branch: allBranches.find((b) => b.$id === bm.branch_id)!,
            bmId: bm.$id,
          }))
          .filter((row) => row.branch)
      );
      setAvailable(allBranches.filter((b) => !assignedIds.has(b.$id)));
    } catch {
      setLoadError("No se pudo cargar la información del jefe.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleQuitar(bmId: string, branchId: string) {
    setActionError(null);
    setBusy((prev) => new Set(prev).add(branchId));
    try {
      await databases.updateDocument(DB_ID, "branch_managers", bmId, {
        asignado_hasta: new Date().toISOString(),
      });
      await loadData();
    } catch {
      setActionError("No se pudo quitar la sucursal. Intenta de nuevo.");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(branchId);
        return next;
      });
    }
  }

  async function handleAgregar(branch: Branch) {
    setActionError(null);
    setBusy((prev) => new Set(prev).add(branch.$id));
    try {
      await databases.createDocument(DB_ID, "branch_managers", ID.unique(), {
        user_id: id,
        branch_id: branch.$id,
        asignado_desde: new Date().toISOString(),
        asignado_hasta: null,
      });
      await loadData();
    } catch {
      setActionError("No se pudo agregar la sucursal. Intenta de nuevo.");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(branch.$id);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  if (loadError || !jefe) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{loadError ?? "Jefe no encontrado."}</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <button
          onClick={() => router.push("/admin/usuarios")}
          className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1"
        >
          ← Volver a usuarios
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          Sucursales de {jefe.nombre_completo}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{jefe.email}</p>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {actionError}
        </p>
      )}

      {/* Asignadas actualmente */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          Asignadas actualmente ({assigned.length})
        </h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-gray-400">Sin sucursales asignadas.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {assigned.map(({ branch, bmId }) => (
              <div key={bmId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{branch.nombre}</p>
                  <p className="text-xs text-gray-400">{branch.codigo_area}</p>
                </div>
                <button
                  onClick={() => handleQuitar(bmId, branch.$id)}
                  disabled={busy.has(branch.$id)}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                >
                  {busy.has(branch.$id) ? "Quitando…" : "Quitar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Disponibles para agregar */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          Disponibles para agregar ({available.length})
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-gray-400">
            No hay sucursales activas sin asignar.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {available.map((branch) => (
              <div key={branch.$id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{branch.nombre}</p>
                  <p className="text-xs text-gray-400">{branch.codigo_area}</p>
                </div>
                <button
                  onClick={() => handleAgregar(branch)}
                  disabled={busy.has(branch.$id)}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors"
                >
                  {busy.has(branch.$id) ? "Agregando…" : "Agregar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
