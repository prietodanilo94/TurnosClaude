"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { selectProposalForMonth } from "@/lib/proposals/select-proposal";
import { useCalendarStore } from "@/store/calendar-store";

export function ProposalSelector() {
  const availableProposals = useCalendarStore((s) => s.availableProposals);
  const activeProposalId = useCalendarStore((s) => s.activeProposalId);
  const branchId = useCalendarStore((s) => s.branchId);
  const year = useCalendarStore((s) => s.year);
  const month = useCalendarStore((s) => s.month);
  const selectProposal = useCalendarStore((s) => s.selectProposal);
  const { user } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (availableProposals.length === 0) return null;

  if (availableProposals.length === 1) {
    const proposal = availableProposals[0];
    return (
      <p className="text-sm text-gray-500">
        Propuesta: {proposal.modo.toUpperCase()} - score {proposal.score.toFixed(1)}{" "}
        {proposal.factible ? "OK" : "X"}
      </p>
    );
  }

  async function handleChange(nextProposalId: string) {
    if (!user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await selectProposalForMonth(branchId, year, month, nextProposalId, user.$id);
      selectProposal(nextProposalId);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "No se pudo seleccionar la propuesta."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="proposal-select" className="text-sm text-gray-500 whitespace-nowrap">
        Propuesta:
      </label>
      <select
        id="proposal-select"
        value={activeProposalId ?? ""}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={saving}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {availableProposals.map((proposal, index) => (
          <option key={proposal.id} value={proposal.id}>
            #{index + 1} {proposal.modo.toUpperCase()} - score {proposal.score.toFixed(1)}{" "}
            {proposal.factible ? "OK" : "X"}
          </option>
        ))}
      </select>
      {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
    </div>
  );
}
