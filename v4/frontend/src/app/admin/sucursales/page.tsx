import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getAllPatterns } from "@/lib/patterns/catalog";
import { getSession } from "@/lib/auth/session";
import type { ShiftCategory } from "@/types";
import CategorySelector from "./[id]/CategorySelector";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const allowedIds = session?.branchIds ?? [];

  const branches = await prisma.branch.findMany({
    where: isAdmin ? undefined : { id: { in: allowedIds } },
    include: {
      teams: {
        include: { _count: { select: { workers: { where: { activo: true } } } } },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const allPatterns = getAllPatterns();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {branches.length} sucursal{branches.length !== 1 ? "es" : ""}
        </p>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            {isAdmin ? "No hay sucursales cargadas aún." : "No tienes sucursales asignadas."}
          </p>
          {isAdmin && (
            <Link
              href="/admin/dotacion"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Subir dotación →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sucursal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Área
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría de turno
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedores
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {branches.flatMap((branch) =>
                branch.teams.map((team) => {
                  const workerCount = team._count.workers;
                  const canView = !!team.categoria && workerCount >= 3;
                  const categoryOptions = allPatterns
                    .filter((p) => p.areaNegocio === team.areaNegocio)
                    .map((p) => ({ id: p.id, label: p.label }));

                  return (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className="font-medium">{branch.nombre}</span>
                        <span className="ml-2 text-xs text-gray-400">{branch.codigo}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          team.areaNegocio === "ventas"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isAdmin ? (
                          <CategorySelector
                            teamId={team.id}
                            current={team.categoria as ShiftCategory | null}
                            options={categoryOptions}
                            compact
                          />
                        ) : (
                          <span className="text-xs text-gray-600">
                            {team.categoria
                              ? (categoryOptions.find((o) => o.id === team.categoria)?.label ?? team.categoria)
                              : <span className="text-gray-400 italic">Sin asignar</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {workerCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canView ? (
                          <Link
                            href={`/admin/sucursales/${branch.id}/calendario/${year}/${month}?team=${team.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Ver calendario →
                          </Link>
                        ) : (
                          <span
                            className="text-sm text-gray-300 cursor-not-allowed"
                            title={
                              !team.categoria
                                ? "Selecciona una categoría primero"
                                : "Se requieren al menos 3 vendedores"
                            }
                          >
                            Ver calendario
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
