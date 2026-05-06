"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCalendar } from "@/lib/calendar/generator";
import type { ShiftCategory } from "@/types";

export interface TeamSlice {
  teamId: string;
  workerIds: string[];
}

interface Props {
  categoria: ShiftCategory;
  year: number;
  month: number;
  slices: TeamSlice[]; // one per team, in order
  hasCalendar: boolean;
}

export default function GenerateButton({ categoria, year, month, slices, hasCalendar }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalWorkers = slices.reduce((sum, s) => sum + s.workerIds.length, 0);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      // Generate one combined calendar for all workers
      const { slots: combinedSlots } = generateCalendar(categoria, year, month, totalWorkers);

      let offset = 0;
      for (const slice of slices) {
        const N = slice.workerIds.length;

        // Take this team's portion of the combined slots, renumber to 1..N
        const teamSlots = combinedSlots
          .filter((s) => s.slotNumber > offset && s.slotNumber <= offset + N)
          .map((s) => ({ ...s, slotNumber: s.slotNumber - offset }));

        // Auto-assign workers to slots in order
        const assignments: Record<string, string | null> = {};
        slice.workerIds.forEach((workerId, i) => {
          assignments[String(i + 1)] = workerId;
        });

        const res = await fetch("/api/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: slice.teamId, year, month, slotsData: teamSlots, assignments }),
        });

        if (!res.ok) {
          setError((await res.json()).error ?? "Error al generar");
          return;
        }

        offset += N;
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
        disabled={loading || totalWorkers === 0}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Generando..." : hasCalendar ? "Regenerar" : "Generar"}
      </button>
    </div>
  );
}
