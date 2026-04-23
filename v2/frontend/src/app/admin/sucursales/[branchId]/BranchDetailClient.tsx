"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ID, Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { Branch, Clasificacion, Proposal, TipoFranja, Worker } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

const CLASIFICACION_OPTIONS: Array<{
  value: Clasificacion;
  label: string;
  defaultTipoFranja: TipoFranja;
}> = [
  { value: "standalone", label: "Stand Alone", defaultTipoFranja: "standalone" },
  { value: "mall_sin_dom", label: "Mall sin domingo", defaultTipoFranja: "movicenter" },
  { value: "mall_7d", label: "Mall 7 dias", defaultTipoFranja: "movicenter" },
  { value: "mall_autopark", label: "Mall Autopark", defaultTipoFranja: "autopark" },
];

const TIPO_FRANJA_OPTIONS: Array<{ value: TipoFranja; label: string }> = [
  { value: "standalone", label: "standalone" },
  { value: "autopark", label: "autopark" },
  { value: "movicenter", label: "movicenter" },
  { value: "tqaoev", label: "tqaoev" },
  { value: "sur", label: "sur" },
];

function formatClasificacion(value?: Clasificacion): string {
  return CLASIFICACION_OPTIONS.find((option) => option.value === value)?.label ?? "Sin definir";
}

function defaultTipoFranjaForClasificacion(clasificacion: Clasificacion): TipoFranja {
  return (
    CLASIFICACION_OPTIONS.find((option) => option.value === clasificacion)?.defaultTipoFranja ??
    "standalone"
  );
}

function getCurrentMonthParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function BranchDetailClient({ branchId }: { branchId: string }) {
  const { user, isAdmin, loading: userLoading } = useCurrentUser();
  const [{ year, month }] = useState(getCurrentMonthParts);

  const [branch, setBranch] = useState<Branch | null>(null);
  const [workerCount, setWorkerCount] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clasificacion, setClasificacion] = useState<Clasificacion>("standalone");
  const [tipoFranja, setTipoFranja] = useState<TipoFranja>("standalone");
  const [updateCatalog, setUpdateCatalog] = useState(false);

  const loadBranch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchDoc, workersRes, proposalsRes] = await Promise.all([
        databases.getDocument(DB, "branches", branchId),
        databases.listDocuments(DB, "workers", [
          Query.equal("branch_id", branchId),
          Query.equal("activo", true),
          Query.limit(500),
        ]),
        databases.listDocuments(DB, "proposals", [
          Query.equal("branch_id", branchId),
          Query.equal("anio", year),
          Query.equal("mes", month),
          Query.notEqual("estado", "descartada"),
          Query.limit(50),
        ]),
      ]);

      const nextBranch = branchDoc as unknown as Branch;
      setBranch(nextBranch);
      setClasificacion(nextBranch.clasificacion ?? "standalone");
      setTipoFranja(nextBranch.tipo_franja);
      setWorkerCount((workersRes.documents as unknown as Worker[]).length);
      setProposalCount((proposalsRes.documents as unknown as Proposal[]).length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la sucursal.");
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => {
    void loadBranch();
  }, [loadBranch]);

  const hasChanges = useMemo(() => {
    if (!branch) return false;
    return (
      (branch.clasificacion ?? "standalone") !== clasificacion ||
      branch.tipo_franja !== tipoFranja
    );
  }, [branch, clasificacion, tipoFranja]);

  async function handleSave() {
    if (!branch || !user) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await databases.updateDocument(DB, "branches", branch.$id, {
        clasificacion,
        tipo_franja: tipoFranja,
      });

      if (updateCatalog) {
        await databases.updateDocument(DB, "area_catalog", branch.codigo_area, {
          clasificacion,
          tipo_franja: tipoFranja,
        });
      }

      await databases.createDocument(DB, "audit_log", ID.unique(), {
        user_id: user.$id,
        accion: "branch.update_classification",
        entidad: "branches",
        entidad_id: branch.$id,
        metadata: JSON.stringify({
          codigo_area: branch.codigo_area,
          before: {
            clasificacion: branch.clasificacion ?? null,
            tipo_franja: branch.tipo_franja,
          },
          after: {
            clasificacion,
            tipo_franja: tipoFranja,
          },
          update_area_catalog: updateCatalog,
        }),
      });

      setSuccessMsg("Clasificacion guardada correctamente.");
      setIsEditing(false);
      setUpdateCatalog(false);
      await loadBranch();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar la clasificacion."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || userLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando sucursal...</div>;
  }

  if (error && !branch) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!branch) {
    return <div className="p-6 text-sm text-gray-500">Sucursal no encontrada.</div>;
  }

  return (
    <div className="max-w-4xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/sucursales" className="text-sm text-blue-600 hover:underline">
            {"<-"} Volver a sucursales
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{branch.nombre}</h1>
          <p className="text-sm text-gray-500">
            Codigo area {branch.codigo_area} · {workerCount} trabajador
            {workerCount === 1 ? "" : "es"} activo{workerCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/sucursales/${branch.$id}/mes/${year}/${month}`}
            className="px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
          >
            Ver calendario
          </Link>
          {isAdmin && (
            <button
              onClick={() => {
                setIsEditing((prev) => !prev);
                setError(null);
                setSuccessMsg(null);
                setClasificacion(branch.clasificacion ?? "standalone");
                setTipoFranja(branch.tipo_franja);
                setUpdateCatalog(false);
              }}
              className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {isEditing ? "Cancelar" : "Editar clasificacion"}
            </button>
          )}
        </div>
      </div>

      {proposalCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ya existen {proposalCount} propuesta{proposalCount === 1 ? "" : "s"} del mes {month}/
          {year}. Cambiar la clasificacion no afecta las propuestas existentes; solo se aplicara a
          nuevas generaciones.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Informacion de la sucursal</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Clasificacion</dt>
            <dd className="mt-1 text-sm text-gray-800">{formatClasificacion(branch.clasificacion)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Tipo franja</dt>
            <dd className="mt-1 text-sm text-gray-800">{branch.tipo_franja}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Activa</dt>
            <dd className="mt-1 text-sm text-gray-800">{branch.activa ? "Si" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Creada desde Excel</dt>
            <dd className="mt-1 text-sm text-gray-800">{branch.creada_desde_excel ? "Si" : "No"}</dd>
          </div>
        </dl>
      </section>

      {isAdmin && isEditing && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Cambiar clasificacion</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Clasificacion</span>
              <select
                value={clasificacion}
                onChange={(e) => {
                  const nextClasificacion = e.target.value as Clasificacion;
                  setClasificacion(nextClasificacion);
                  setTipoFranja(defaultTipoFranjaForClasificacion(nextClasificacion));
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLASIFICACION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Tipo franja</span>
              <select
                value={tipoFranja}
                onChange={(e) => setTipoFranja(e.target.value as TipoFranja)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIPO_FRANJA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={updateCatalog}
              onChange={(e) => setUpdateCatalog(e.target.checked)}
              className="mt-0.5"
            />
            <span>Actualizar tambien area_catalog para futuras importaciones.</span>
          </label>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setClasificacion(branch.clasificacion ?? "standalone");
                setTipoFranja(branch.tipo_franja);
                setUpdateCatalog(false);
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
