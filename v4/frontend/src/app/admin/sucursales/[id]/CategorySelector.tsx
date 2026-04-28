"use client";

import { useState } from "react";
import type { ShiftCategory } from "@/types";

interface Props {
  teamId: string;
  current: ShiftCategory | null;
  options: { id: string; label: string }[];
}

export default function CategorySelector({ teamId, current, options }: Props) {
  const [value, setValue] = useState<string>(current ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(newVal: string) {
    setValue(newVal);
    setSaved(false);
    setError("");
    if (!newVal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/categoria`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: newVal }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al guardar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">— Seleccionar categoría —</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {saving && <span className="text-xs text-gray-400">Guardando…</span>}
      {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
