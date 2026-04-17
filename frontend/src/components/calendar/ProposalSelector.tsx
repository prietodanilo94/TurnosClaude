"use client";

import { useCalendarStore } from "@/store/calendar-store";

export function ProposalSelector() {
  const availableProposals = useCalendarStore((s) => s.availableProposals);
  const activeProposalId = useCalendarStore((s) => s.activeProposalId);
  const selectProposal = useCalendarStore((s) => s.selectProposal);

  if (availableProposals.length === 0) return null;

  if (availableProposals.length === 1) {
    const p = availableProposals[0];
    return (
      <p className="text-sm text-gray-500">
        Propuesta: {p.modo.toUpperCase()} — score {p.score.toFixed(1)}{" "}
        {p.factible ? "✓" : "✗"}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="proposal-select" className="text-sm text-gray-500 whitespace-nowrap">
        Propuesta:
      </label>
      <select
        id="proposal-select"
        value={activeProposalId ?? ""}
        onChange={(e) => selectProposal(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {availableProposals.map((p, i) => (
          <option key={p.id} value={p.id}>
            #{i + 1} {p.modo.toUpperCase()} — score {p.score.toFixed(1)}{" "}
            {p.factible ? "✓" : "✗"}
          </option>
        ))}
      </select>
    </div>
  );
}
