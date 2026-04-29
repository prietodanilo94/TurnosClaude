"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShiftCategory } from "@/types";

interface Props {
  teamId: string;
  current: ShiftCategory | null;
  options: { id: string; label: string }[];
  compact?: boolean;
}

export default function CategorySelector({ teamId, current, options, compact }: Props) {
  const router = useRouter();
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
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  const selectClass = compact
    ? "px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[260px]"
    : "px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50";

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className={selectClass}
      >
        <option value="">— Sin asignar —</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {saving && <span className="text-xs text-gray-400">…</span>}
      {saved && <span className="text-xs text-green-600">✓</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
