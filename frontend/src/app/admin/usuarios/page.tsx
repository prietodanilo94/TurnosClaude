"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { User, BranchManager } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

interface JefeRow {
  user: User;
  sucursalesActivas: number;
}

export default function UsuariosPage() {
  const [rows, setRows] = useState<JefeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [usersResult, bmResult] = await Promise.all([
          databases.listDocuments(DB_ID, "users", [
            Query.equal("rol", "jefe_sucursal"),
            Query.limit(100),
          ]),
          databases.listDocuments(DB_ID, "branch_managers", [
            Query.isNull("asignado_hasta"),
            Query.limit(500),
          ]),
        ]);

        if (cancelled) return;

        const jefes = usersResult.documents as unknown as User[];
        const bms = bmResult.documents as unknown as BranchManager[];

        const countByUser: Record<string, number> = {};
        for (const bm of bms) {
          countByUser[bm.user_id] = (countByUser[bm.user_id] ?? 0) + 1;
        }

        setRows(
          jefes.map((u) => ({
            user: u,
            sucursalesActivas: countByUser[u.$id] ?? 0,
          }))
        );
      } catch {
        if (!cancelled) setError("No se pudo cargar la lista de usuarios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jefes de sucursal registrados</p>
        </div>
        <Link
          href="/admin/usuarios/nuevo"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Nuevo jefe
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Cargando…</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-500">No hay jefes de sucursal registrados.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sucursales
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map(({ user, sucursalesActivas }) => (
                <tr key={user.$id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {user.nombre_completo}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{sucursalesActivas}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/usuarios/${user.$id}`}
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
