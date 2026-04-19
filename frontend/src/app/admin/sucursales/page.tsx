"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Branch } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    databases
      .listDocuments(DB, "branches", [
        Query.equal("activa", true),
        Query.orderAsc("nombre"),
        Query.limit(200),
      ])
      .then((r) => setBranches(r.documents as unknown as Branch[]))
      .catch(() => setError("No se pudieron cargar las sucursales."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">Cargando sucursales…</div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600 text-sm">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Sucursales</h1>

      {branches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay sucursales activas. Carga dotación desde{" "}
          <Link href="/admin/dotacion" className="text-blue-600 underline">
            Dotación
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white max-w-xl">
          {branches.map((b) => (
            <li key={b.$id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{b.nombre}</p>
                <p className="text-xs text-gray-400">{b.codigo_area}</p>
              </div>
              <Link
                href={`/admin/sucursales/${b.$id}/mes/${year}/${month}`}
                className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
              >
                Ver calendario →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
