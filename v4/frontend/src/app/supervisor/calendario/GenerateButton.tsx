"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarSlot } from "@/types";

interface Props {
  teamId: string;
  year: number;
  month: number;
  slots: CalendarSlot[];
  workerCount: number;
  hasCalendar: boolean;
}

export default function GenerateButton({ teamId, year, month, slots, workerCount, hasCalendar }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const assignments: Record<string, null> = {};
      slots.forEach((slot) => { assignments[String(slot.slotNumber)] = null; });

      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, year, month, slotsData: slots, assignments }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Error al generar");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Generando..." : hasCalendar ? "Regenerar" : "Generar"}
      </button>
    </div>
  );
}
