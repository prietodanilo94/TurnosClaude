import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getAllPatterns } from "@/lib/patterns/catalog";
import { getSession } from "@/lib/auth/session";
import type { ShiftCategory } from "@/types";
import CategorySelector from "./[id]/CategorySelector";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  await getSession();

  const [branches, groups] = await Promise.all([
    prisma.branch.findMany({
      include: {
        teams: {
          include: { _count: { select: { workers: { where: { activo: true } } } } },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.branchGroup.findMany({
      include: {
        branches: {
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const groupedBranchIds = new Set(groups.flatMap((g) => g.branches.map((b) => b.id)));
  const ungrouped = branches.filter((b) => !groupedBranchIds.has(b.id));

  const allPatterns = getAllPatterns();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const tableHead = (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedores</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sucursales</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {branches.length} sucursal{branches.length !== 1 ? "es" : ""}
          {groups.length > 0 && ` · ${groups.length} grupo${groups.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No hay sucursales cargadas aún.</p>
          <Link href="/admin/dotacion" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Subir dotación →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            {tableHead}
            <tbody className="bg-white divide-y divide-gray-100">

              {/* Grupos */}
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-blue-50/30 bg-blue-50/10">
                  <td className="px-4 py-3 text-sm text-gray-900" colSpan={4}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{group.nombre}</span>
                      <span className="text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Grupo</span>
                      <span className="text-xs text-gray-400">
                        ({group.branches.map((b) => b.nombre).join(" · ")})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/grupos`}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Gestionar
                      </Link>
                      <Link
                        href={`/supervisor/calendario?groupId=${group.id}&year=${year}&month=${month}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Asignación de Turnos →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Sucursales individuales */}
              {ungrouped.flatMap((branch) =>
                branch.teams.map((team) => {
                  const workerCount = team._count.workers;
                  const canView = !!team.categoria && workerCount >= 3;
                  const categoryOptions = allPatterns
                    .filter((pattern) => pattern.areaNegocio === team.areaNegocio)
                    .map((pattern) => ({ id: pattern.id, label: pattern.label }));

                  return (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className="font-medium">{branch.nombre}</span>
                        <span className="ml-2 text-xs text-gray-400">{branch.codigo}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          team.areaNegocio === "ventas" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <CategorySelector
                          teamId={team.id}
                          current={team.categoria as ShiftCategory | null}
                          options={categoryOptions}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{workerCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/admin/sucursales/${branch.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                            Accesos
                          </Link>
                          {canView ? (
                            <Link
                              href={`/admin/sucursales/${branch.id}/calendario/${year}/${month}?team=${team.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Asignación de Turnos →
                            </Link>
                          ) : (
                            <span
                              className="text-sm text-gray-300 cursor-not-allowed"
                              title={!team.categoria ? "Selecciona una categoría primero" : "Se requieren al menos 3 vendedores"}
                            >
                              Asignación de Turnos
                            </span>
                          )}
                        </div>
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
