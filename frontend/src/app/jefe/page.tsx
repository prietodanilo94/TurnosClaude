"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { useJefeUser } from "@/lib/auth/jefe-user-context";
import type { Branch } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function JefeDashboard() {
  const { authorizedBranchIds, loading } = useJefeUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  useEffect(() => {
    if (loading || authorizedBranchIds.length === 0) return;

    setBranchesLoading(true);
    databases
      .listDocuments(DB_ID, "branches", [
        Query.equal("$id", authorizedBranchIds),
        Query.equal("activa", true),
      ])
      .then((res) => setBranches(res.documents as unknown as Branch[]))
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [loading, authorizedBranchIds]);

  if (loading || branchesLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Cargando sucursales…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Mis Sucursales</h1>
      <p className="text-sm text-gray-500 mt-1">
        Seleccioná una sucursal para gestionar sus turnos.
      </p>

      {branches.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No tenés sucursales asignadas.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Link
              key={branch.$id}
              href={`/jefe/sucursales/${branch.$id}`}
              className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-colors"
            >
              <p className="font-medium text-gray-900">{branch.nombre}</p>
              <p className="text-xs text-gray-500 mt-1">
                {branch.codigo_area} · {branch.tipo_franja}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
