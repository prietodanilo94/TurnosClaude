"use client";

import { useState } from "react";

interface Props {
  teamIds: string[];
  current: string | null;
  options: { id: string; label: string }[];
}

export default function CategoryPicker({ teamIds, current, options }: Props) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(newVal: string) {
    setValue(newVal);
    if (!newVal) return;
    setSaving(true);
    setError("");
    try {
      for (const teamId of teamIds) {
        const res = await fetch(`/api/teams/${teamId}/categoria`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoria: newVal }),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Error al guardar");
          setSaving(false);
          return;
        }
      }
      window.location.reload();
    } catch {
      setError("Error de conexión");
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[220px]"
      >
        <option value="">— Sin categoría —</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      {saving && <span className="text-xs text-gray-400">…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
