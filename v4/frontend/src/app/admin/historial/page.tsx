import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

interface Props {
  searchParams: {
    branchId?: string;
    action?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}

const PAGE_SIZE = 50;

function parseMetadata(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fmtDetail(metadata: Record<string, unknown> | null) {
  if (!metadata) return "Sin detalle";
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export const dynamic = "force-dynamic";

export default async function HistorialPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    branchId: searchParams.branchId || undefined,
    action: searchParams.action ? { contains: searchParams.action } : undefined,
    userEmail: searchParams.user ? { contains: searchParams.user } : undefined,
    createdAt: {
      gte: searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : undefined,
      lte: searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : undefined,
    },
  };

  const [logs, total, branches] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { branch: { select: { nombre: true, codigo: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.auditLog.count({ where }),
    prisma.branch.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = new URLSearchParams();
  if (searchParams.branchId) query.set("branchId", searchParams.branchId);
  if (searchParams.action) query.set("action", searchParams.action);
  if (searchParams.user) query.set("user", searchParams.user);
  if (searchParams.from) query.set("from", searchParams.from);
  if (searchParams.to) query.set("to", searchParams.to);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Historial</h1>
        <p className="text-xs text-gray-400 mt-0.5">{total} registro{total !== 1 ? "s" : ""}</p>
      </div>

      <form className="bg-white border border-gray-200 rounded-lg p-4 mb-4 grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sucursal</label>
          <select
            name="branchId"
            defaultValue={searchParams.branchId ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.nombre} ({branch.codigo})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Accion</label>
          <input
            name="action"
            defaultValue={searchParams.action ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="calendar.generate"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
          <input
            name="user"
            defaultValue={searchParams.user ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="correo"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="md:col-span-5 flex items-center justify-end gap-2">
          <Link href="/admin/historial" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">
            Limpiar
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Fecha", "Usuario", "Accion", "Sucursal", "Detalle"].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay registros para esos filtros.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const metadata = parseMetadata(log.metadata);
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {log.createdAt.toLocaleString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{log.userEmail || "Sistema"}</div>
                      <div className="text-xs text-gray-400">{log.userRole || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.action}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.branch ? `${log.branch.nombre} (${log.branch.codigo})` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtDetail(metadata)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Pagina {page} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={`/admin/historial?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page - 1) })}`} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
              Anterior
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Anterior</span>
          )}
          {page < totalPages ? (
            <Link href={`/admin/historial?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page + 1) })}`} className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
              Siguiente
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Siguiente</span>
          )}
        </div>
      </div>
    </div>
  );
}
