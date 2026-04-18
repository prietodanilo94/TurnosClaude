"use client";

import { useState, useEffect } from "react";
import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import { createException } from "@/lib/exceptions/api";
import {
  exceptionSchema,
  hasDuplicateDia,
  hasDuplicateTurno,
  hasVacacionesOverlap,
} from "@/lib/exceptions/validation";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { WorkerConstraint, ShiftCatalog } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const DIAS = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

type UITipo = "dia_prohibido" | "turno_prohibido" | "vacaciones" | "dia_obligatorio_libre";

interface Props {
  workerId: string;
  existing: WorkerConstraint[];
  onCreated: () => void;
  onClose: () => void;
}

export function NewExceptionDialog({ workerId, existing, onCreated, onClose }: Props) {
  const { user } = useCurrentUser();

  const [tipo, setTipo] = useState<UITipo>("dia_prohibido");
  const [valor, setValor] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [notas, setNotas] = useState("");

  const [shifts, setShifts] = useState<ShiftCatalog[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Cargar turnos cuando se selecciona turno_prohibido
  useEffect(() => {
    if (tipo !== "turno_prohibido" || shifts.length > 0) return;
    databases
      .listDocuments(DB, "shift_catalog", [Query.limit(50)])
      .then((r) => setShifts(r.documents as unknown as ShiftCatalog[]))
      .catch(() => {});
  }, [tipo, shifts.length]);

  function resetFields() {
    setValor("");
    setFechaDesde("");
    setFechaHasta("");
    setFieldError(null);
  }

  function handleTipoChange(next: UITipo) {
    setTipo(next);
    resetFields();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (!user?.$id) {
      setFieldError("No se pudo identificar al usuario. Recargá la página.");
      return;
    }

    // Construir payload para Zod
    let raw: Record<string, unknown>;
    if (tipo === "dia_prohibido") {
      raw = { tipo, valor, notas: notas || undefined };
    } else if (tipo === "turno_prohibido") {
      raw = { tipo, valor, notas: notas || undefined };
    } else if (tipo === "vacaciones") {
      raw = { tipo, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, notas: notas || undefined };
    } else {
      // dia_obligatorio_libre → se valida con su propio schema, luego se guarda como vacaciones
      raw = { tipo, fecha_desde: fechaDesde, notas: notas || undefined };
    }

    const parsed = exceptionSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message);
      return;
    }

    // Validaciones de duplicado / solapamiento
    if (tipo === "dia_prohibido" && hasDuplicateDia(existing, valor)) {
      setFieldError(`Ya existe una restricción de día prohibido para "${valor}".`);
      return;
    }
    if (tipo === "turno_prohibido" && hasDuplicateTurno(existing, valor)) {
      setFieldError(`Ya existe una restricción de turno prohibido para "${valor}".`);
      return;
    }
    const efectivoDesde = tipo === "dia_obligatorio_libre" ? fechaDesde : fechaDesde;
    const efectivoHasta = tipo === "dia_obligatorio_libre" ? fechaDesde : fechaHasta;
    if ((tipo === "vacaciones" || tipo === "dia_obligatorio_libre") &&
        hasVacacionesOverlap(existing, efectivoDesde, efectivoHasta)) {
      setFieldError("Ese rango se solapa con unas vacaciones ya registradas.");
      return;
    }

    setSaving(true);
    try {
      await createException({
        worker_id: workerId,
        // dia_obligatorio_libre se guarda como vacaciones con desde === hasta
        tipo: tipo === "dia_obligatorio_libre" ? "vacaciones" : tipo,
        valor: (tipo === "dia_prohibido" || tipo === "turno_prohibido") ? valor : undefined,
        fecha_desde: (tipo === "vacaciones" || tipo === "dia_obligatorio_libre") ? efectivoDesde : undefined,
        fecha_hasta: (tipo === "vacaciones" || tipo === "dia_obligatorio_libre") ? efectivoHasta : undefined,
        notas: notas || undefined,
        creado_por: user.$id,
      });
      onCreated();
      onClose();
    } catch {
      setFieldError("No se pudo guardar la excepción. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva excepción</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value as UITipo)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="dia_prohibido">Día prohibido</option>
              <option value="turno_prohibido">Turno prohibido</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="dia_obligatorio_libre">Día obligatorio libre</option>
            </select>
          </div>

          {/* Día prohibido */}
          {tipo === "dia_prohibido" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Día</label>
              <select
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccioná un día…</option>
                {DIAS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Turno prohibido */}
          {tipo === "turno_prohibido" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
              {shifts.length > 0 ? (
                <select
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccioná un turno…</option>
                  {shifts.map((s) => (
                    <option key={s.$id} value={s.$id}>
                      {s.nombre_display} ({s.hora_inicio}–{s.hora_fin})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="ID del turno (ej: S_09_19)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          )}

          {/* Vacaciones */}
          {tipo === "vacaciones" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  min={fechaDesde || undefined}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Día obligatorio libre */}
          {tipo === "dia_obligatorio_libre" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: estudia los martes"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {fieldError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {fieldError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
