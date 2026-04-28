import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getAllPatterns, CATEGORY_LABELS } from "@/lib/patterns/catalog";
import type { ShiftCategory } from "@/types";
import CategorySelector from "./CategorySelector";

interface Props {
  params: { id: string };
  searchParams: { team?: string };
}

export default async function BranchDetailPage({ params, searchParams }: Props) {
  const branch = await prisma.branch.findUnique({
    where: { id: params.id },
    include: {
      teams: {
        include: {
          workers: { where: { activo: true }, orderBy: { nombre: "asc" } },
          _count: { select: { workers: { where: { activo: true } } } },
        },
      },
    },
  });

  if (!branch) notFound();

  // Si hay query ?team=, mostrar solo ese equipo; si no, mostrar todos
  const teams = searchParams.team
    ? branch.teams.filter((t) => t.id === searchParams.team)
    : branch.teams;

  const allPatterns = getAllPatterns();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-1 flex items-center gap-2">
        <Link href="/admin/sucursales" className="text-xs text-gray-400 hover:text-gray-600">
          ← Sucursales
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{branch.nombre}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Código: {branch.codigo}</p>
      </div>

      <div className="space-y-6">
        {teams.map((team) => {
          const workerCount = team._count.workers;
          const needsVirtual = workerCount === 2;
          const alert3 =
            workerCount === 3 &&
            allPatterns.find((p) => p.id === team.categoria)?.rotationWeeks.length === 4;

          return (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  team.areaNegocio === "ventas"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {team.areaNegocio === "ventas" ? "Ventas" : "Postventa"}
                </span>
                <span className="text-xs text-gray-500">{workerCount} trabajador{workerCount !== 1 ? "es" : ""}</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Selector de categoría */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Categoría de turno</p>
                  <CategorySelector
                    teamId={team.id}
                    current={team.categoria as ShiftCategory | null}
                    options={allPatterns
                      .filter((p) => p.areaNegocio === team.areaNegocio)
                      .map((p) => ({ id: p.id, label: p.label }))}
                  />
                </div>

                {/* Alertas */}
                {needsVirtual && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-3 text-xs text-orange-800">
                    Solo hay 2 trabajadores. Para generar el calendario se necesita al menos 1 más.
                    {/* TODO etapa 2: botón agregar trabajador virtual */}
                    <span className="ml-1 font-medium">(Función disponible próximamente)</span>
                  </div>
                )}

                {alert3 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                    Con 3 trabajadores en rotación de 4 semanas, queda un puesto descubierto.
                    El administrador o jefe debe cubrir ese turno manualmente.
                  </div>
                )}

                {/* Lista de trabajadores */}
                {team.workers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">Trabajadores</p>
                    <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                      {team.workers.map((w) => (
                        <li key={w.id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm text-gray-800">{w.nombre}</span>
                          <span className="text-xs text-gray-400">{w.rut}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ir al calendario */}
                {team.categoria && workerCount >= 3 && (
                  <div className="pt-1">
                    <Link
                      href={`/admin/sucursales/${branch.id}/calendario/${year}/${month}?team=${team.id}`}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-block"
                    >
                      Ver calendario {month}/{year} →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
