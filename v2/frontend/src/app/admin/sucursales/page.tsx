"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Branch } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [workerCount, setWorkerCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    async function load() {
      try {
        const branchRes = await databases.listDocuments(DB, "branches", [
          Query.equal("activa", true),
          Query.orderAsc("nombre"),
          Query.limit(200),
        ]);
        const branchList = branchRes.documents as unknown as Branch[];
        setBranches(branchList);

        if (branchList.length > 0) {
          const ids = branchList.map((branch) => branch.$id);
          const workerRes = await databases.listDocuments(DB, "workers", [
            Query.equal("branch_id", ids),
            Query.equal("activo", true),
            Query.limit(1000),
          ]);
          const counts: Record<string, number> = {};
          for (const doc of workerRes.documents) {
            const currentBranchId = (doc as unknown as { branch_id: string }).branch_id;
            counts[currentBranchId] = (counts[currentBranchId] ?? 0) + 1;
          }
          setWorkerCount(counts);
        }
      } catch {
        setError("No se pudieron cargar las sucursales.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = search.trim()
    ? branches.filter(
        (branch) =>
          branch.nombre.toLowerCase().includes(search.toLowerCase()) ||
          branch.codigo_area.toLowerCase().includes(search.toLowerCase())
      )
    : branches;

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando sucursales...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">{branches.length} activa(s).</p>
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay sucursales activas. Carga dotacion desde{" "}
          <Link href="/admin/dotacion" className="text-blue-600 underline">
            Dotacion
          </Link>
          .
        </p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Buscar sucursal..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400">Sin resultados para &quot;{search}&quot;.</p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
              {filtered.map((branch) => {
                const count = workerCount[branch.$id] ?? 0;
                return (
                  <li key={branch.$id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{branch.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {branch.codigo_area} · {branch.tipo_franja} ·{" "}
                        <span className={count === 0 ? "text-red-400" : "text-gray-400"}>
                          {count === 0 ? "sin trabajadores" : `${count} trabajador${count === 1 ? "" : "es"}`}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/sucursales/${branch.$id}`}
                        className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                      >
                        Ver ficha
                      </Link>
                      <Link
                        href={`/admin/sucursales/${branch.$id}/mes/${year}/${month}`}
                        className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        Ver calendario -&gt;
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
