"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { createJefeSucursal } from "@/lib/admin/create-jefe";
import type { Branch } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function NuevoJefePage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rut, setRut] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    databases
      .listDocuments(DB_ID, "branches", [Query.equal("activa", true), Query.limit(100)])
      .then((res) => setBranches(res.documents as unknown as Branch[]))
      .catch(() => {})
      .finally(() => setLoadingBranches(false));
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "El nombre es obligatorio.";
    if (!email.trim()) errs.email = "El email es obligatorio.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido.";
    if (!password) errs.password = "La contraseña es obligatoria.";
    else if (password.length < 8) errs.password = "Mínimo 8 caracteres.";
    if (selectedBranches.size === 0) errs.branches = "Selecciona al menos una sucursal.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createJefeSucursal({
        email: email.trim(),
        password,
        nombre_completo: nombre.trim(),
        rut: rut.trim() || undefined,
        branch_ids: Array.from(selectedBranches),
      });
      router.push("/admin/usuarios");
    } catch (e: any) {
      setGlobalError(e.message ?? "Error al crear el jefe.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleBranch(id: string) {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Nuevo jefe de sucursal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          La contraseña deberá comunicarse al jefe de forma offline.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.nombre && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jefe@empresa.cl"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña temporal <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
          <input
            type="text"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="12345678-9"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sucursales asignadas <span className="text-red-500">*</span>
          </label>
          {loadingBranches ? (
            <p className="text-sm text-gray-400">Cargando sucursales…</p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-gray-400">No hay sucursales activas.</p>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {branches.map((b) => (
                <label
                  key={b.$id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranches.has(b.$id)}
                    onChange={() => toggleBranch(b.$id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {b.nombre}
                    <span className="ml-2 text-xs text-gray-400">{b.codigo_area}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {fieldErrors.branches && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.branches}</p>
          )}
        </div>

        {globalError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {globalError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creando…" : "Crear jefe"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
