"use client";

import { useState } from "react";

export default function ToggleVisto({ id, initialVisto }: { id: string; initialVisto: boolean }) {
  const [visto, setVisto] = useState(initialVisto);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !visto;
    const res = await fetch(`/api/historial/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visto: next }),
    });
    if (res.ok) setVisto(next);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={visto ? "Marcar como no visto" : "Marcar como visto"}
      className={`w-4 h-4 rounded border transition-colors disabled:opacity-40 ${
        visto
          ? "bg-blue-500 border-blue-500 hover:bg-blue-600"
          : "bg-white border-gray-400 hover:border-blue-400"
      }`}
    >
      {visto && (
        <svg className="w-3 h-3 text-white mx-auto" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
