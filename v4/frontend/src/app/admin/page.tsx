import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [branches, workers] = await Promise.all([
    prisma.branch.count(),
    prisma.worker.count({ where: { activo: true, esVirtual: false } }),
  ]);

  const teamsWithCategory = await prisma.branchTeam.count({
    where: { categoria: { not: null } },
  });

  const teamsTotal = await prisma.branchTeam.count();
  const pendingCategory = teamsTotal - teamsWithCategory;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-xs text-gray-400 mt-0.5">Resumen general</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Sucursales</p>
          <p className="text-2xl font-semibold text-gray-900">{branches}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Trabajadores activos</p>
          <p className="text-2xl font-semibold text-gray-900">{workers}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Equipos sin categoría</p>
          <p className={`text-2xl font-semibold ${pendingCategory > 0 ? "text-orange-600" : "text-gray-900"}`}>
            {pendingCategory}
          </p>
        </div>
      </div>

      {pendingCategory > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-orange-800">
            Hay {pendingCategory} equipo{pendingCategory > 1 ? "s" : ""} sin categoría de turno asignada.{" "}
            <Link href="/admin/sucursales" className="font-medium underline">
              Ir a Sucursales
            </Link>{" "}
            para completarlos.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Acciones rápidas</h2>
        <div className="flex gap-3">
          <Link
            href="/admin/dotacion"
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Subir dotación
          </Link>
          <Link
            href="/admin/sucursales"
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Ver sucursales
          </Link>
        </div>
      </div>
    </div>
  );
}
