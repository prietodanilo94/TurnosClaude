"use client";

import Link from "next/link";
import { useState, Fragment } from "react";

export interface WorkerEvent {
  logId: string;
  savedAt: string;
  savedBy: string;
  year: number;
  month: number;
  calendarLastExportedAt: string | null;
  downloadedSinceChange: boolean;
  calendarUrl: string;
  changes: {
    date: string;
    dayLabel: string;
    from: string | null;
    to: string | null;
  }[];
}

export interface WorkerRow {
  workerId: string;
  workerName: string;
  workerRut: string;
  branchNombre: string;
  branchCodigo: string;
  areaNegocio: string;
  hasPending: boolean;
  events: WorkerEvent[];
}

interface Filters {
  from: string;
  to: string;
  branchId: string;
  supervisorId: string;
  worker: string;
  onlyPending: string;
}

interface Props {
  rows: WorkerRow[];
  total: number;
  totalPending: number;
  totalEvents: number;
  page: number;
  totalPages: number;
  branches: { id: string; nombre: string; codigo: string }[];
  supervisors: { id: string; nombre: string }[];
  filters: Filters;
}

const MONTHS_ES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function DayChangeRow({ change }: { change: WorkerEvent["changes"][0] }) {
  const { dayLabel, from, to } = change;
  const isAdded   = !from && !!to;
  const isRemoved = !!from && !to;

  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${
        isAdded ? "bg-green-400" : isRemoved ? "bg-red-400" : "bg-yellow-400"
      }`} />
      <span className="w-28 text-gray-500 shrink-0">{dayLabel}</span>
      {from
        ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono whitespace-nowrap">{from}</span>
        : <span className="text-gray-400 italic">libre</span>
      }
      <span className="text-gray-400 text-[10px]">→</span>
      {to
        ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono whitespace-nowrap">{to}</span>
        : <span className="text-gray-400 italic">libre</span>
      }
    </div>
  );
}

function EventCard({ event }: { event: WorkerEvent }) {
  const savedDate  = new Date(event.savedAt);
  const lastExport = event.calendarLastExportedAt ? new Date(event.calendarLastExportedAt) : null;

  return (
    <div className="border-t border-gray-100 pt-2 pb-1 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">
            {savedDate.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500">{event.savedBy}</span>
          {event.downloadedSinceChange ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 whitespace-nowrap">
              ✓ Descargado{lastExport ? ` ${lastExport.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}` : ""}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700 whitespace-nowrap">
              ⚠ Pendiente descarga
            </span>
          )}
        </div>
        {event.calendarUrl && (
          <Link href={event.calendarUrl} className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap">
            Ver {MONTHS_ES[event.month]} {event.year} →
          </Link>
        )}
      </div>
      <div className="pl-4 space-y-0.5">
        {event.changes.map((c, i) => <DayChangeRow key={i} change={c} />)}
      </div>
    </div>
  );
}

function WorkerTableRow({ row }: { row: WorkerRow }) {
  const [expanded, setExpanded] = useState(false);
  const rutDisplay = row.workerRut ? row.workerRut.split("-")[0] : "—";

  return (
    <Fragment>
      <tr
        className="hover:bg-gray-50 cursor-pointer border-b border-gray-100"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-gray-400 shrink-0">{expanded ? "▾" : "▸"}</span>
            <span className="font-medium text-sm text-gray-900 truncate">{row.workerName}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{rutDisplay}</td>
        <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[180px]">{row.branchNombre}</td>
        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{row.branchCodigo}</td>
        <td className="px-4 py-2.5 text-xs text-gray-400 capitalize whitespace-nowrap">{row.areaNegocio}</td>
        <td className="px-4 py-2.5 text-xs text-gray-500 text-center whitespace-nowrap">{row.events.length}</td>
        <td className="px-4 py-2.5 whitespace-nowrap">
          {row.hasPending ? (
            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700">⚠ Pendiente</span>
          ) : (
            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">✓ Descargado</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/60 border-b border-gray-100">
          <td colSpan={7} className="px-6 py-3">
            <div className="space-y-1">
              {row.events.map(e => <EventCard key={e.logId} event={e} />)}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function ExportarV2Client({
  rows, total, totalPending, totalEvents,
  page, totalPages,
  branches, supervisors,
  filters,
}: Props) {
  const buildQuery = (overrides: Record<string, string>) => {
    const merged = { ...filters, ...overrides };
    const q = new URLSearchParams();
    if (merged.from)          q.set("from",         merged.from);
    if (merged.to)            q.set("to",           merged.to);
    if (merged.branchId)      q.set("branchId",     merged.branchId);
    if (merged.supervisorId)  q.set("supervisorId", merged.supervisorId);
    if (merged.worker)        q.set("worker",       merged.worker);
    if (merged.onlyPending === "1") q.set("onlyPending", "1");
    return q.toString();
  };

  const hasFilters = !!(filters.from || filters.to || filters.branchId || filters.worker || filters.supervisorId || filters.onlyPending);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Cambios por trabajador</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Historial de modificaciones de calendario con estado de descarga RRHH.
        </p>
      </div>

      {/* Filtros */}
      <form className="bg-white border border-gray-200 rounded-lg p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Supervisor</label>
          <select name="supervisorId" defaultValue={filters.supervisorId}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">Todos</option>
            {supervisors.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sucursal</label>
          <select name="branchId" defaultValue={filters.branchId}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">Todas</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.nombre} ({b.codigo})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Trabajador</label>
          <input name="worker" defaultValue={filters.worker} placeholder="nombre o RUT"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
          <input type="date" name="from" defaultValue={filters.from}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
          <input type="date" name="to" defaultValue={filters.to}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
            Filtrar
          </button>
          <Link href="/admin/exportar-v2"
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md">
            ✕
          </Link>
        </div>
        <div className="md:col-span-3 lg:col-span-6 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="onlyPending"
              value="1"
              defaultChecked={filters.onlyPending === "1"}
              className="w-4 h-4 rounded border-gray-300 text-orange-500"
            />
            Solo con cambios pendientes de descarga
          </label>
        </div>
      </form>

      {/* Stats */}
      {hasFilters && (
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          <span><span className="font-medium text-gray-900">{total}</span> trabajador{total !== 1 ? "es" : ""}</span>
          <span className="text-gray-300">·</span>
          <span><span className="font-medium text-gray-900">{totalEvents}</span> evento{totalEvents !== 1 ? "s" : ""}</span>
          {totalPending > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-orange-600">{totalPending} con cambios pendientes</span>
            </>
          )}
        </div>
      )}

      {/* Tabla */}
      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          {hasFilters
            ? "No hay cambios de calendario para esos filtros."
            : "Usa los filtros para buscar cambios de calendario."
          }
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">RUT</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Cód.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Área</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Eventos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => <WorkerTableRow key={row.workerId} row={row} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm pt-2">
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/admin/exportar-v2?${buildQuery({ page: String(page - 1) })}`}
                className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">Anterior</Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Anterior</span>
            )}
            {page < totalPages ? (
              <Link href={`/admin/exportar-v2?${buildQuery({ page: String(page + 1) })}`}
                className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">Siguiente</Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Siguiente</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
