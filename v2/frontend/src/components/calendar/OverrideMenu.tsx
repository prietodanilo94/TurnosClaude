"use client";

import { useMemo, useState } from "react";
import type { OverrideType, SlotOverride } from "@/types/models";
import type { CalendarAssignment, ShiftDef } from "@/types/optimizer";

export interface OverrideTarget {
  date: string;
  slot: number;
  workerLabel: string;
  assignment?: CalendarAssignment;
  existingOverride?: SlotOverride;
  isSunday: boolean;
}

interface OverrideMenuProps {
  target: OverrideTarget;
  shifts: ShiftDef[];
  onClose: () => void;
  onApply: (params: {
    tipo: OverrideType;
    shiftIdNuevo?: string;
    notas?: string;
  }) => Promise<void>;
  onRevert: (override: SlotOverride) => Promise<void>;
}

export function OverrideMenu({
  target,
  shifts,
  onClose,
  onApply,
  onRevert,
}: OverrideMenuProps) {
  const [mode, setMode] = useState<OverrideType | null>(null);
  const [shiftIdNuevo, setShiftIdNuevo] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableShifts = useMemo(
    () =>
      shifts.filter((shift) =>
        target.assignment ? shift.id !== target.assignment.shift_id : true
      ),
    [shifts, target.assignment]
  );

  async function handleApply() {
    if (!mode) return;
    if ((mode === "cambiar_turno" || mode === "marcar_trabajado") && !shiftIdNuevo) {
      setError("Selecciona un turno.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onApply({
        tipo: mode,
        shiftIdNuevo: shiftIdNuevo || undefined,
        notas: notas.trim() || undefined,
      });
      onClose();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "No se pudo aplicar el override.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    if (!target.existingOverride) return;
    setSaving(true);
    setError(null);
    try {
      await onRevert(target.existingOverride);
      onClose();
    } catch (revertError) {
      setError(
        revertError instanceof Error ? revertError.message : "No se pudo revertir el override."
      );
    } finally {
      setSaving(false);
    }
  }

  const title = target.assignment ? "Override de slot" : "Override de dia libre";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {target.workerLabel} · {target.date} · slot {target.slot}
          </p>
        </div>

        {target.existingOverride ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Ya existe un override activo de tipo <strong>{target.existingOverride.tipo}</strong>.
            </div>
            <button
              onClick={() => void handleRevert()}
              disabled={saving}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300"
            >
              {saving ? "Revirtiendo..." : "Revertir override"}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {target.assignment ? (
                <>
                  <button
                    onClick={() => setMode("cambiar_turno")}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      mode === "cambiar_turno"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Cambiar turno
                  </button>
                  <button
                    onClick={() => setMode("marcar_libre")}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      mode === "marcar_libre"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Marcar como libre
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setMode("marcar_trabajado")}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      mode === "marcar_trabajado"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Agregar turno
                  </button>
                  {target.isSunday && (
                    <button
                      onClick={() => setMode("proteger_domingo")}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        mode === "proteger_domingo"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Proteger domingo libre
                    </button>
                  )}
                </>
              )}
            </div>

            {(mode === "cambiar_turno" || mode === "marcar_trabajado") && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Turno</span>
                <select
                  value={shiftIdNuevo}
                  onChange={(event) => setShiftIdNuevo(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona un turno</option>
                  {availableShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.nombre_display ?? shift.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {mode && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notas</span>
                <textarea
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </label>
            )}

            {mode && (
              <button
                onClick={() => void handleApply()}
                disabled={saving}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {saving ? "Aplicando..." : "Aplicar override"}
              </button>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
