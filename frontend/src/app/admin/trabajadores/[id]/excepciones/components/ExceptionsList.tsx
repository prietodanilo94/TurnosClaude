"use client";

import { useState } from "react";
import type { WorkerConstraint } from "@/types/models";

const TIPO_LABEL: Record<string, string> = {
  dia_prohibido: "Día prohibido",
  turno_prohibido: "Turno prohibido",
  vacaciones: "Vacaciones",
};

const DIA_LABEL: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ExceptionValue({ exc }: { exc: WorkerConstraint }) {
  if (exc.tipo === "vacaciones") {
    const desde = exc.fecha_desde ? formatDate(exc.fecha_desde) : "?";
    const hasta = exc.fecha_hasta ? formatDate(exc.fecha_hasta) : "?";
    return (
      <span className="font-medium text-gray-900">
        {desde === hasta ? desde : `${desde} al ${hasta}`}
      </span>
    );
  }
  if (exc.tipo === "dia_prohibido") {
    return (
      <span className="font-medium text-gray-900">
        {DIA_LABEL[exc.valor ?? ""] ?? exc.valor ?? "—"}
      </span>
    );
  }
  return (
    <span className="font-medium text-gray-900 font-mono text-xs">
      {exc.valor ?? "—"}
    </span>
  );
}

interface Props {
  exceptions: WorkerConstraint[];
  onEdit?: (exc: WorkerConstraint) => void;
  onDelete?: (exc: WorkerConstraint) => Promise<void>;
  readOnly?: boolean;
}

export function ExceptionsList({ exceptions, onEdit, onDelete, readOnly = false }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleConfirmDelete(exc: WorkerConstraint) {
    setDeletingId(exc.$id);
    try {
      await onDelete?.(exc);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  if (exceptions.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">No hay excepciones registradas.</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {exceptions.map((exc) => (
        <div key={exc.$id} className="py-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-700">
              <span className="text-gray-500">{TIPO_LABEL[exc.tipo] ?? exc.tipo}:</span>{" "}
              <ExceptionValue exc={exc} />
            </p>
            {exc.notas && (
              <p className="text-xs text-gray-500 mt-0.5">Notas: {exc.notas}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Creada por: {exc.creado_por} · {formatDate(exc.$createdAt)}
            </p>
          </div>

          {!readOnly && (
            <div className="flex gap-2 shrink-0 items-center">
              {confirmingId === exc.$id ? (
                <>
                  <span className="text-xs text-gray-600">¿Eliminar?</span>
                  <button
                    onClick={() => handleConfirmDelete(exc)}
                    disabled={deletingId === exc.$id}
                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  >
                    {deletingId === exc.$id ? "Eliminando…" : "Sí"}
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    disabled={deletingId === exc.$id}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onEdit?.(exc)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmingId(exc.$id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
