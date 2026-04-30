"use client";

import { useState } from "react";

interface WorkerInfo {
  id: string;
  nombre: string;
  rut: string;
  hasPassword: boolean;
}

interface Props {
  workers: WorkerInfo[];
}

export default function WorkerAccessManager({ workers }: Props) {
  const [selected, setSelected] = useState<WorkerInfo | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [localWorkers, setLocalWorkers] = useState(workers);

  function openWorker(w: WorkerInfo) {
    setSelected(w);
    setPassword("");
    setError("");
  }

  async function handleSave() {
    if (!selected) return;
    if (!password || password.length < 4) {
      setError("Mínimo 4 caracteres");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/workers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      setLocalWorkers((prev) => prev.map((w) => w.id === selected.id ? { ...w, hasPassword: true } : w));
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!selected) return;
    if (!confirm(`¿Quitar acceso de ${selected.nombre}? No podrá iniciar sesión.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearPassword: true }),
      });
      if (res.ok) {
        setLocalWorkers((prev) => prev.map((w) => w.id === selected.id ? { ...w, hasPassword: false } : w));
        setSelected(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-2">Acceso vendedores</p>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200">
        {localWorkers.map((w) => (
          <li key={w.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <span className="text-sm text-gray-800">{w.nombre}</span>
              <span className="ml-2 text-xs text-gray-400">{w.rut}</span>
            </div>
            <button
              onClick={() => openWorker(w)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                w.hasPassword
                  ? "border-green-300 text-green-700 hover:bg-green-50"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {w.hasPassword ? "● Con acceso" : "○ Sin acceso"}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Acceso de {selected.nombre}</h3>
              <p className="text-xs text-gray-500 mt-0.5">RUT: {selected.rut}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 4 caracteres"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-between items-center pt-1">
              {selected.hasPassword ? (
                <button
                  onClick={handleClear}
                  disabled={saving}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Quitar acceso
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
