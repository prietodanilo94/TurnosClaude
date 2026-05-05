"use client";

import { useState } from "react";
import type { WorkerBlockInfo } from "@/types";

interface WorkerInfo {
  id: string;
  nombre: string;
  rut: string;
  hasPassword: boolean;
  blocks: WorkerBlockInfo[];
}

interface Props {
  workers: WorkerInfo[];
}

const EMPTY_BLOCK_FORM = {
  startDate: "",
  endDate: "",
  motivo: "",
};

function fmtRange(block: WorkerBlockInfo) {
  return `${block.startDate} - ${block.endDate}`;
}

export default function WorkerAccessManager({ workers }: Props) {
  const [selected, setSelected] = useState<WorkerInfo | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blockError, setBlockError] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK_FORM);
  const [localWorkers, setLocalWorkers] = useState(workers);

  function openWorker(worker: WorkerInfo) {
    setSelected(worker);
    setPassword("");
    setError("");
    setBlockError("");
    setBlockForm(EMPTY_BLOCK_FORM);
  }

  function updateWorker(workerId: string, updater: (worker: WorkerInfo) => WorkerInfo) {
    setLocalWorkers((prev) => prev.map((worker) => (worker.id === workerId ? updater(worker) : worker)));
    setSelected((prev) => (prev && prev.id === workerId ? updater(prev) : prev));
  }

  async function handleSavePassword() {
    if (!selected) return;
    if (!password || password.length < 4) {
      setError("Minimo 4 caracteres");
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
      if (!res.ok) {
        setError((await res.json()).error ?? "Error");
        return;
      }
      updateWorker(selected.id, (worker) => ({ ...worker, hasPassword: true }));
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearPassword() {
    if (!selected) return;
    if (!confirm(`Quitar acceso de ${selected.nombre}? No podra iniciar sesion.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearPassword: true }),
      });
      if (res.ok) {
        updateWorker(selected.id, (worker) => ({ ...worker, hasPassword: false }));
        setSelected(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBlock() {
    if (!selected) return;
    if (!blockForm.startDate || !blockForm.endDate) {
      setBlockError("Selecciona fecha inicio y fecha fin");
      return;
    }

    setBlockSaving(true);
    setBlockError("");
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: selected.id,
          startDate: blockForm.startDate,
          endDate: blockForm.endDate,
          motivo: blockForm.motivo,
        }),
      });

      if (!res.ok) {
        setBlockError((await res.json()).error ?? "No se pudo crear el bloqueo");
        return;
      }

      const created = await res.json();
      updateWorker(selected.id, (worker) => ({
        ...worker,
        blocks: [...worker.blocks, created].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      }));
      setBlockForm(EMPTY_BLOCK_FORM);
    } finally {
      setBlockSaving(false);
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!selected) return;
    if (!confirm("Eliminar este bloqueo?")) return;

    setBlockSaving(true);
    try {
      const res = await fetch(`/api/blocks?id=${blockId}`, { method: "DELETE" });
      if (!res.ok) {
        setBlockError((await res.json()).error ?? "No se pudo eliminar el bloqueo");
        return;
      }

      updateWorker(selected.id, (worker) => ({
        ...worker,
        blocks: worker.blocks.filter((block) => block.id !== blockId),
      }));
    } finally {
      setBlockSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-2">Acceso vendedores y bloqueos</p>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200">
        {localWorkers.map((worker) => (
          <li key={worker.id} className="flex items-center justify-between px-3 py-2 gap-3">
            <div className="min-w-0">
              <span className="text-sm text-gray-800">{worker.nombre}</span>
              <span className="ml-2 text-xs text-gray-400">{worker.rut}</span>
              {worker.blocks.length > 0 && (
                <div className="mt-1 text-[11px] text-gray-500">
                  {worker.blocks.length} bloqueo{worker.blocks.length !== 1 ? "s" : ""} activo{worker.blocks.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <button
              onClick={() => openWorker(worker)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors shrink-0 ${
                worker.hasPassword
                  ? "border-green-300 text-green-700 hover:bg-green-50"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {worker.hasPassword ? "Con acceso" : "Sin acceso"}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{selected.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">RUT: {selected.rut}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-gray-600">
                Cerrar
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Acceso</p>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contrasena</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimo 4 caracteres"
                    autoFocus
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex items-center justify-between gap-2">
                  {selected.hasPassword ? (
                    <button
                      onClick={handleClearPassword}
                      disabled={saving}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Quitar acceso
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={handleSavePassword}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Guardando..." : "Guardar acceso"}
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Bloqueos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Inicio</label>
                      <input
                        type="date"
                        value={blockForm.startDate}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Fin</label>
                      <input
                        type="date"
                        value={blockForm.endDate}
                        onChange={(e) => setBlockForm((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
                    <input
                      type="text"
                      value={blockForm.motivo}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, motivo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="vacaciones, licencia, permiso..."
                    />
                  </div>
                  <button
                    onClick={handleCreateBlock}
                    disabled={blockSaving}
                    className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {blockSaving ? "Guardando..." : "Agregar bloqueo"}
                  </button>
                </div>

                {blockError && <p className="text-xs text-red-600">{blockError}</p>}

                {selected.blocks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-400">
                    No hay bloqueos activos o futuros.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {selected.blocks.map((block) => (
                      <li key={block.id} className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{fmtRange(block)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{block.motivo || "Sin motivo"}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            disabled={blockSaving}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
