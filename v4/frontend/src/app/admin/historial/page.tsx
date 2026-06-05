import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ACTION_LABELS, fmtDetail, parseMetadata } from "@/lib/audit/format";
import ToggleVisto from "./ToggleVisto";
import ExportHistorial from "./ExportHistorial";

interface Props {
  searchParams: {
    branchId?: string;
    supervisorId?: string;
    action?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
    noVistos?: string;
  };
}

const PAGE_SIZE = 50;

function calendarLink(log: { branchId: string | null; metadata: string | null }): string | null {
  if (!log.branchId) return null;
  const meta = parseMetadata(log.metadata);
  const year = meta?.year;
  const month = meta?.month;
  const teamId = typeof meta?.teamId === "string" ? meta.teamId : null;
  if (!year || !month) return `/admin/sucursales/${log.branchId}`;
  if (!teamId) return `/admin/sucursales/${log.branchId}`;
  return `/admin/sucursales/${log.branchId}/calendario/${year}/${month}?team=${teamId}`;
}

export const dynamic = "force-dynamic";

export default async function HistorialPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const soloNoVistos = searchParams.noVistos === "1";

  let branchIdsForSupervisor: string[] | undefined;
  if (searchParams.supervisorId) {
    const links = await prisma.supervisorBranch.findMany({
      where: { supervisorId: searchParams.supervisorId },
      select: { branchId: true },
    });
    branchIdsForSupervisor = links.map((l) => l.branchId);
  }

  const where = {
    branchId: branchIdsForSupervisor
      ? { in: branchIdsForSupervisor }
      : searchParams.branchId || undefined,
    action: searchParams.action ? { contains: searchParams.action } : undefined,
    userEmail: searchParams.user ? { contains: searchParams.user } : undefined,
    createdAt: {
      gte: searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : undefined,
      lte: searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : undefined,
    },
    visto: soloNoVistos ? false : undefined,
  };

  const [logs, total, noVistosTotal, branches, supervisors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { branch: { select: { nombre: true, codigo: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { visto: false } }),
    prisma.branch.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
    prisma.supervisor.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = new URLSearchParams();
  if (searchParams.branchId) query.set("branchId", searchParams.branchId);
  if (searchParams.supervisorId) query.set("supervisorId", searchParams.supervisorId);
  if (searchParams.action) query.set("action", searchParams.action);
  if (searchParams.user) query.set("user", searchParams.user);
  if (searchParams.from) query.set("from", searchParams.from);
  if (searchParams.to) query.set("to", searchParams.to);
  if (soloNoVistos) query.set("noVistos", "1");

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Historial</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {total} registro{total !== 1 ? "s" : ""}
            {noVistosTotal > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {noVistosTotal} sin revisar
              </span>
            )}
          </p>
        </div>
        <ExportHistorial
          filters={{
            branchId: searchParams.branchId,
            supervisorId: searchParams.supervisorId,
            action: searchParams.action,
            user: searchParams.user,
            from: searchParams.from,
            to: searchParams.to,
          }}
        />
      </div>

      <form className="bg-white border border-gray-200 rounded-lg p-4 mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Supervisor</label>
          <select
            name="supervisorId"
            defaultValue={searchParams.supervisorId ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Todos</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sucursal</label>
          <select
            name="branchId"
            defaultValue={searchParams.branchId ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nombre} ({b.codigo})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Acción</label>
          <select
            name="action"
            defaultValue={searchParams.action ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
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
          <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
          <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div className="md:col-span-3 lg:col-span-6 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="noVistos"
              value="1"
              defaultChecked={soloNoVistos}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            Solo sin revisar
          </label>
          <div className="flex items-center gap-2">
            <Link href="/admin/historial" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">
              Limpiar
            </Link>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                Visto
              </th>
              {["Fecha", "Usuario", "Acción", "Sucursal", "Detalle", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay registros para esos filtros.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const metadata = parseMetadata(log.metadata);
                const link = calendarLink(log);
                return (
                  <tr key={log.id} className={`hover:bg-gray-50 ${!log.visto ? "bg-amber-50" : ""}`}>
                    <td className="px-3 py-3">
                      <ToggleVisto id={log.id} initialVisto={log.visto} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {log.createdAt.toLocaleString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{log.userEmail || "Sistema"}</div>
                      <div className="text-xs text-gray-400">{log.userRole || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.branch ? `${log.branch.nombre} (${log.branch.codigo})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {fmtDetail(metadata, log.action)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {link && (
                        <Link href={link} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                          Ver calendario →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">Página {page} de {totalPages}</span>
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
