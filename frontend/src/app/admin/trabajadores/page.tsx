"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Worker, Branch } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function TrabajadoresPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("__all__");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [wResult, bResult] = await Promise.all([
          databases.listDocuments(DB, "workers", [
            Query.limit(500),
            Query.orderAsc("nombre_completo"),
          ]),
          databases.listDocuments(DB, "branches", [
            Query.limit(200),
            Query.orderAsc("nombre"),
          ]),
        ]);
        if (cancelled) return;
        setWorkers(wResult.documents as unknown as Worker[]);
        setBranches(bResult.documents as unknown as Branch[]);
      } catch {
        if (!cancelled) setError("No se pudo cargar la lista de trabajadores.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const branchMap = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.$id, b.nombre])),
    [branches]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((w) => {
      const matchSearch =
        !q ||
        w.nombre_completo.toLowerCase().includes(q) ||
        w.rut.toLowerCase().includes(q);
      const matchBranch =
        branchFilter === "__all__" || w.branch_id === branchFilter;
      return matchSearch && matchBranch;
    });
  }, [workers, search, branchFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Trabajadores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Cargando…" : `${filtered.length} trabajador${filtered.length !== 1 ? "es" : ""}`}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o RUT…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="__all__">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.$id} value={b.$id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-gray-500">No se encontraron trabajadores.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RUT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sucursal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervisor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((w) => (
                <tr key={w.$id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {w.nombre_completo}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {w.rut}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {branchMap[w.branch_id] ?? w.branch_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {w.supervisor_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {w.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/trabajadores/${w.$id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
