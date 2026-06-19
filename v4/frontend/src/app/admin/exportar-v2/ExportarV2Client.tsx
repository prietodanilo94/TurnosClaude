"use client";

import Link from "next/link";
import { useState } from "react";

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
  const isAdded    = !from && !!to;
  const isRemoved  = !!from && !to;
  const isModified = !!from && !!to;

  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isAdded ? "bg-green-400" : isRemoved ? "bg-red-400" : isModified ? "bg-yellow-400" : "bg-gray-300"
        }`}
        title={isAdded ? "Asignado" : isRemoved ? "Eliminado" : "Modificado"}
      />
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
  const savedDate = new Date(event.savedAt);
  const lastExport = event.calendarLastExportedAt ? new Date(event.calendarLastExportedAt) : null;

  return (
    <div className="border-t border-gray-100 pt-2 pb-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">
            {savedDate.toLocaleString("es-CL", {
              day: "2-digit", month: "2-digit", year: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
          <span className="text-xs text-gray-400">·</span>
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

function WorkerCard({ row }: { row: WorkerRow }) {
  const [expanded, setExpanded] = useState(true);
  const rutDisplay = row.workerRut ? row.workerRut.split("-")[0] : "—";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="text-[10px] text-gray-400 shrink-0">{expanded ? "▾" : "▸"}</span>
          <span className="font-medium text-sm text-gray-900 truncate">{row.workerName}</span>
          <span className="text-xs text-gray-400 font-mono shrink-0">{rutDisplay}</span>
          <span className="text-xs text-gray-500 shrink-0">{row.branchNombre}</span>
          <span className="text-xs text-gray-400 shrink-0">({row.branchCodigo})</span>
          <span className="text-xs text-gray-400 capitalize shrink-0">{row.areaNegocio}</span>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className="text-xs text-gray-400">
            {row.events.length} evento{row.events.length !== 1 ? "s" : ""}
          </span>
          {row.hasPending ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700">⚠ Pendiente</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">✓ Descargado</span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-2 space-y-0 border-t border-gray-100">
          {row.events.map(e => <EventCard key={e.logId} event={e} />)}
        </div>
      )}
    </div>
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
    if (merged.from) q.set("from", merged.from);
    if (merged.to) q.set("to", merged.to);
    if (merged.branchId) q.set("branchId", merged.branchId);
    if (merged.supervisorId) q.set("supervisorId", merged.supervisorId);
    if (merged.worker) q.set("worker", merged.worker);
    return q.toString();
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
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
      </form>

      {/* Stats */}
      {(total > 0 || filters.from || filters.to || filters.branchId || filters.worker) && (
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          <span><span className="font-medium text-gray-900">{total}</span> trabajador{total !== 1 ? "es" : ""}</span>
          <span className="text-gray-300">·</span>
          <span><span className="font-medium text-gray-900">{totalEvents}</span> evento{totalEvents !== 1 ? "s" : ""}</span>
          {totalPending > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-orange-600">
                {totalPending} con cambios pendientes de descarga
              </span>
            </>
          )}
        </div>
      )}

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          {filters.from || filters.to || filters.branchId || filters.worker || filters.supervisorId
            ? "No hay cambios de calendario para esos filtros."
            : "Usa los filtros para buscar cambios de calendario."
          }
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => <WorkerCard key={row.workerId} row={row} />)}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm pt-2">
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/admin/exportar-v2?${buildQuery({ page: String(page - 1) })}`}
                className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                Anterior
              </Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Anterior</span>
            )}
            {page < totalPages ? (
              <Link href={`/admin/exportar-v2?${buildQuery({ page: String(page + 1) })}`}
                className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                Siguiente
              </Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded text-gray-300">Siguiente</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
