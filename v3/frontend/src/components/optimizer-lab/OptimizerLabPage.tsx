"use client";

import { useMemo, useState } from "react";
import type { LabDay, OptimizerLabInput, OptimizerLabResponse } from "@/lib/optimizer-lab/types";

const today = new Date();

const initialForm: OptimizerLabInput = {
  category: "ventas_mall_dominical",
  solverMode: "heuristic",
  year: today.getFullYear(),
  month: today.getMonth() + 1,
  dotation: 4,
  weeklyHoursTarget: 42,
  maxConsecutiveDays: 6,
  minFreeSundays: 2,
  numProposals: 3,
  timeLimitSeconds: 30,
};

function weekdayShortLabel(day: LabDay) {
  return `${day.weekday.slice(0, 2).toUpperCase()} ${day.date.slice(-2)}`;
}

function buildRowMap(result: OptimizerLabResponse | null, proposalId: string | null) {
  if (!result || !proposalId) return new Map<string, string>();
  const proposal = result.proposals.find((item) => item.id === proposalId);
  if (!proposal) return new Map<string, string>();

  return new Map(
    proposal.assignments.map((assignment) => [
      `${assignment.slotNumber}-${assignment.date}`,
      assignment.label,
    ])
  );
}

export function OptimizerLabPage() {
  const [form, setForm] = useState<OptimizerLabInput>(initialForm);
  const [result, setResult] = useState<OptimizerLabResponse | null>(null);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowMap = useMemo(
    () => buildRowMap(result, activeProposalId),
    [result, activeProposalId]
  );

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/optimizer-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Error ${response.status}`);
      }

      const data = (await response.json()) as OptimizerLabResponse;
      setResult(data);
      setActiveProposalId(data.proposals[0]?.id ?? null);
    } catch (fetchError) {
      setResult(null);
      setActiveProposalId(null);
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo generar.");
    } finally {
      setLoading(false);
    }
  }

  const activeProposal = result?.proposals.find((proposal) => proposal.id === activeProposalId) ?? null;

  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Shift Optimizer v3
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Optimizer Lab</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Laboratorio inicial para validar dotacion, factibilidad y diagnostico del solver en
            sucursales dominicales antes de construir el flujo completo de v3.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            onSubmit={handleGenerate}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Parametros</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Primera version enfocada en la categoria dominical mas compleja.
                </p>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Categoria</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as OptimizerLabInput["category"],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ventas_mall_dominical">Ventas Mall Dominical</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Modo de solver</span>
                <select
                  value={form.solverMode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      solverMode: event.target.value as OptimizerLabInput["solverMode"],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="heuristic">Heuristico</option>
                  <option value="cp_sat">OR-Tools CP-SAT</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Ano</span>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, year: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Mes</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={form.month}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, month: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Dotacion</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.dotation}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dotation: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Propuestas</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.numProposals}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        numProposals: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Horas objetivo</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.weeklyHoursTarget}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        weeklyHoursTarget: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Max dias seguidos</span>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={form.maxConsecutiveDays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxConsecutiveDays: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Domingos libres min.</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.minFreeSundays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minFreeSundays: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Time limit</span>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={form.timeLimitSeconds}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        timeLimitSeconds: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {loading ? "Generando..." : "Generar propuestas"}
              </button>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </form>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Diagnostico</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Resultado inicial del laboratorio para mes visible y semanas extendidas.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    result?.diagnostic.feasible
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {result ? (result.diagnostic.feasible ? "Factible" : "Infactible") : "Sin ejecutar"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Categoria</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result?.diagnostic.categoryLabel ?? "-"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {result?.diagnostic.solverMode === "cp_sat" ? "OR-Tools CP-SAT" : "Heuristico"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Dotacion</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result?.diagnostic.dotationAvailable ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Min sugerida</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result?.diagnostic.minimumSuggested ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Rango efectivo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result
                      ? `${result.diagnostic.effectiveStart} -> ${result.diagnostic.effectiveEnd}`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Mensajes</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {(result?.diagnostic.messages.length ?? 0) > 0 ? (
                    result?.diagnostic.messages.map((message) => <li key={message}>- {message}</li>)
                  ) : (
                    <li>- Aun no hay diagnostico generado.</li>
                  )}
                </ul>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Propuestas</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Selecciona una propuesta para revisar la grilla mensual.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {result ? `${result.proposals.length} propuesta(s)` : "0 propuestas"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {result?.proposals.map((proposal) => (
                  <button
                    key={proposal.id}
                    type="button"
                    onClick={() => setActiveProposalId(proposal.id)}
                    className={`min-w-[180px] rounded-xl border px-4 py-3 text-left transition ${
                      activeProposalId === proposal.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{proposal.id}</p>
                    <p className="mt-1 text-xs text-slate-500">Score {proposal.score}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Horas promedio {proposal.metrics.averageHours}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Domingos libres min {proposal.metrics.minFreeSundays}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Cobertura minima {proposal.metrics.minCoverage}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Grilla mensual</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Vista simplificada por slots anonimos, alineada a la esencia de v1/v2.
                  </p>
                </div>
                {activeProposal ? (
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">APE</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">CIE</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">COM</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Libre</span>
                  </div>
                ) : null}
              </div>

              {result && activeProposal ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slot
                        </th>
                        {result.visibleDays.map((day) => (
                          <th
                            key={day.date}
                            className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {weekdayShortLabel(day)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: result.input.dotation }, (_, index) => index + 1).map((slot) => (
                        <tr key={slot}>
                          <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 text-sm font-medium text-slate-900">
                            Trabajador {slot}
                          </td>
                          {result.visibleDays.map((day) => {
                            const label = rowMap.get(`${slot}-${day.date}`) ?? "-";
                            const classes =
                              label === "APE"
                                ? "bg-sky-50 text-sky-700"
                                : label === "CIE"
                                ? "bg-amber-50 text-amber-700"
                                : label === "COM"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-50 text-slate-500";
                            return (
                              <td
                                key={`${slot}-${day.date}`}
                                className={`border-b border-slate-100 px-3 py-2 text-center text-xs font-semibold ${classes}`}
                              >
                                {label}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Genera propuestas para revisar la grilla mensual.
                </div>
              )}
            </section>

            {activeProposal ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Metricas de la propuesta</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Horas promedio</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeProposal.metrics.averageHours}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Domingos libres</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeProposal.metrics.minFreeSundays} - {activeProposal.metrics.maxFreeSundays}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">APE / CIE / COM</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeProposal.metrics.shiftCounts.V_M7_APE} / {activeProposal.metrics.shiftCounts.V_M7_CIE} / {activeProposal.metrics.shiftCounts.V_M7_COM}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Cobertura minima</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeProposal.metrics.minCoverage}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Score</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{activeProposal.score}</p>
                  </div>
                </div>

                {activeProposal.metrics.coverageDeficitDays.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-semibold">Dias con cobertura insuficiente</p>
                    <ul className="mt-2 space-y-1">
                      {activeProposal.metrics.coverageDeficitDays.map((day) => (
                        <li key={day}>- {day}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
