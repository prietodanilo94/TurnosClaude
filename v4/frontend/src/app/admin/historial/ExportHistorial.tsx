"use client";

import { useState } from "react";

interface Props {
  /** Filtros activos de la página (se respetan en el export) */
  filters: {
    branchId?: string;
    supervisorId?: string;
    action?: string;
    user?: string;
    from?: string;
    to?: string;
  };
}

export default function ExportHistorial({ filters }: Props) {
  const [visto, setVisto] = useState<"all" | "si" | "no">("all");

  function handleExport() {
    const params = new URLSearchParams();
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.supervisorId) params.set("supervisorId", filters.supervisorId);
    if (filters.action) params.set("action", filters.action);
    if (filters.user) params.set("user", filters.user);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("visto", visto);
    window.open(`/api/historial/export?${params}`, "_blank");
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={visto}
        onChange={(e) => setVisto(e.target.value as "all" | "si" | "no")}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Qué registros incluir según su estado de revisión"
      >
        <option value="all">Todos</option>
        <option value="si">Solo revisados</option>
        <option value="no">Solo sin revisar</option>
      </select>
      <button
        onClick={handleExport}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors whitespace-nowrap"
      >
        Descargar Excel
      </button>
    </div>
  );
}
