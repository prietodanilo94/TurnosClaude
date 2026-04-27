"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeFactibilityOption } from "@/lib/factibilidad/analyzer";
import { getFactibilityScenarios } from "@/lib/factibilidad/scenarios";
import {
  FACTIBILITY_WEEKDAYS,
  type FactibilityOption,
  type FactibilityView,
  type FactibilityWeekday,
  type FactibilityWorkerTemplate,
} from "@/lib/factibilidad/types";

const DAY_LABELS: Record<FactibilityWeekday, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mie",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sab",
  domingo: "Dom",
};

function cloneWorkers(workers: FactibilityWorkerTemplate[]): FactibilityWorkerTemplate[] {
  return workers.map((worker) => ({
    ...worker,
    weeklyRoles: [...worker.weeklyRoles],
    offDays: [...worker.offDays],
  }));
}

function optionTone(recommended: boolean) {
  return recommended
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-white text-slate-800";
}

function roleCellClass(role: "APE" | "CIE", isOff: boolean, isSunday: boolean) {
  if (isOff) {
    return isSunday
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  }

  if (role === "APE") {
    return isSunday
      ? "bg-sky-100 text-sky-800 border-sky-200"
      : "bg-sky-50 text-sky-700 border-sky-200";
  }

  return isSunday
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

function verdictClass(tone: "bad" | "warn" | "good") {
  if (tone === "bad") return "bg-rose-100 text-rose-700";
  if (tone === "warn") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}

export function FactibilidadPageClient() {
  const scenarios = useMemo(() => getFactibilityScenarios(), []);
  const [headcount, setHeadcount] = useState(6);
  const [viewMode, setViewMode] = useState<FactibilityView["mode"]>("month");
  const [monthValue, setMonthValue] = useState("2026-05");

  const scenario = useMemo(
    () => scenarios.find((item) => item.headcount === headcount) ?? scenarios[0],
    [headcount, scenarios]
  );

  const [optionId, setOptionId] = useState(
    scenario.options.find((item) => item.recommended)?.id ?? scenario.options[0].id
  );

  useEffect(() => {
    setOptionId(scenario.options.find((item) => item.recommended)?.id ?? scenario.options[0].id);
  }, [scenario]);

  const selectedOption = useMemo(
    () => scenario.options.find((item) => item.id === optionId) ?? scenario.options[0],
    [optionId, scenario]
  );

  const [workers, setWorkers] = useState<FactibilityWorkerTemplate[]>(() =>
    cloneWorkers(selectedOption.workers)
  );

  useEffect(() => {
    setWorkers(cloneWorkers(selectedOption.workers));
  }, [selectedOption]);

  const liveOption: FactibilityOption = useMemo(
    () => ({
      ...selectedOption,
      workers,
    }),
    [selectedOption, workers]
  );

  const analysisView = useMemo<FactibilityView>(() => {
    if (viewMode === "month") {
      const [year, month] = monthValue.split("-").map(Number);
      return { mode: "month", year, month };
    }
    return { mode: "cycle" };
  }, [monthValue, viewMode]);

  const analysis = useMemo(
    () => analyzeFactibilityOption(liveOption, analysisView),
    [analysisView, liveOption]
  );

  const weeks = useMemo(() => {
    const grouped = new Map<number, (typeof analysis.coverageCells)[number][]>();
    for (const cell of analysis.coverageCells) {
      if (!grouped.has(cell.weekIndex)) grouped.set(cell.weekIndex, []);
      grouped.get(cell.weekIndex)!.push(cell);
    }
    return Array.from(grouped.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([, cells]) => cells);
  }, [analysis]);

  function setOffDay(workerId: string, cycleWeekIndex: number, day: FactibilityWeekday) {
    setWorkers((current) =>
      current.map((worker) =>
        worker.id === workerId
          ? {
              ...worker,
              offDays: worker.offDays.map((currentDay, currentWeek) =>
                currentWeek === cycleWeekIndex ? day : currentDay
              ),
            }
          : worker
      )
    );
  }

  function resetOption() {
    setWorkers(cloneWorkers(selectedOption.workers));
  }

  const errors = analysis.violations.filter((item) => item.severity === "error");
  const workerErrorIds = new Set(errors.map((item) => item.workerId).filter(Boolean));

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[1500px] p-6 space-y-6">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_38%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#1e293b_100%)] px-6 py-8 text-white shadow-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-sky-200">Mall 7 dias</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Analizador visual de factibilidad
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Compara opciones APE/CIE por dotacion, ajusta los libres semana a semana y mira
                al instante si se rompe cobertura, domingos o la racha maxima de 6 dias.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">Ciclo</div>
                <div className="mt-1 text-lg font-semibold">4 semanas</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">Limite duro</div>
                <div className="mt-1 text-lg font-semibold">6 dias seguidos</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-slate-300">Domingos</div>
                <div className="mt-1 text-lg font-semibold">Max 2 trabajados</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{scenario.title}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${verdictClass(scenario.verdictTone)}`}>
                  {scenario.verdict}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {scenario.baselineAnalysis}
              </p>
            </div>
            <button
              onClick={resetOption}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Restaurar propuesta base
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Modo de analisis
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Cambia entre el ciclo abstracto de 4 semanas y un mes real con sus domingos
                  efectivos.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-slate-200">
                  <button
                    onClick={() => setViewMode("cycle")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "cycle"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Ciclo base
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "month"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Mes real
                  </button>
                </div>
                {viewMode === "month" && (
                  <label className="flex flex-col gap-1 text-sm text-slate-600">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Mes</span>
                    <input
                      type="month"
                      value={monthValue}
                      onChange={(event) => setMonthValue(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {scenarios.map((item) => (
              <button
                key={item.headcount}
                onClick={() => setHeadcount(item.headcount)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  item.headcount === scenario.headcount
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                N = {item.headcount}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {scenario.options.map((option) => (
              <button
                key={option.id}
                onClick={() => setOptionId(option.id)}
                className={`rounded-[22px] border p-4 text-left transition ${
                  option.id === selectedOption.id
                    ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                    : optionTone(option.recommended)
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{option.title}</h3>
                      {option.recommended && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            option.id === selectedOption.id
                              ? "bg-white/15 text-white"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          Recomendada
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-2 text-sm leading-6 ${
                        option.id === selectedOption.id ? "text-slate-100" : "text-slate-600"
                      }`}
                    >
                      {option.headline}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      option.id === selectedOption.id
                        ? "bg-white/10 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {option.scheme}
                  </span>
                </div>
                <div
                  className={`mt-4 flex flex-wrap gap-2 text-xs ${
                    option.id === selectedOption.id ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  <span className="rounded-full border border-current/20 px-2.5 py-1">
                    {option.roleCountsLabel}
                  </span>
                  <span className="rounded-full border border-current/20 px-2.5 py-1">
                    {option.workers.length} trabajadores
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Lectura corta
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selectedOption.shortAnalysis}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {selectedOption.summaryBullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Alertas de contexto
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{scenario.fifthSundayNote}</p>
              {scenario.mixedOutlook && (
                <div className="mt-3 rounded-2xl bg-slate-100 px-3 py-3 text-sm leading-6 text-slate-700">
                  {scenario.mixedOutlook}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-5">
            {weeks.map((coverageForWeek, weekIndex) => {
              const cycleWeekIndex = coverageForWeek[0]?.cycleWeekIndex ?? 0;

              return (
                <div
                  key={weekIndex}
                  className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {viewMode === "month" ? `Semana visible ${weekIndex + 1}` : `Semana ${weekIndex + 1}`}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Haz clic en una celda para mover el libre. Esta semana usa el patron del
                        ciclo {cycleWeekIndex + 1}.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {coverageForWeek.map((cell) => (
                        <span
                          key={cell.date}
                          className={`rounded-full px-3 py-1 font-semibold ${
                            cell.meetsBaseCoverage
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {DAY_LABELS[cell.day]} {cell.date.slice(8, 10)} {cell.apeOnDuty}A / {cell.cieOnDuty}C
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3">Trabajador</th>
                          {FACTIBILITY_WEEKDAYS.map((day) => (
                            <th key={day} className="px-3 py-3 text-center">
                              {DAY_LABELS[day]}
                            </th>
                          ))}
                          <th className="px-5 py-3 text-right">Semana</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map((worker) => {
                          const role = worker.weeklyRoles[cycleWeekIndex];
                          const isWorkerFlagged = workerErrorIds.has(worker.id);
                          return (
                            <tr
                              key={`${worker.id}-${weekIndex}`}
                              className={isWorkerFlagged ? "bg-rose-50/70" : "bg-white"}
                            >
                              <td className="px-5 py-3 align-top">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-900">{worker.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {worker.group} · {role}
                                  </span>
                                </div>
                              </td>
                              {FACTIBILITY_WEEKDAYS.map((day) => {
                                const dateCell = coverageForWeek.find((cell) => cell.day === day);
                                const isOff = worker.offDays[cycleWeekIndex] === day;
                                return (
                                  <td key={day} className="px-2 py-2 text-center">
                                    <button
                                      onClick={() => setOffDay(worker.id, cycleWeekIndex, day)}
                                      className={`w-20 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                                        dateCell?.inMonth ? "" : "opacity-50"
                                      } ${roleCellClass(
                                        role,
                                        isOff,
                                        day === "domingo"
                                      )}`}
                                    >
                                      {isOff ? "LIB" : role}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="px-5 py-3 text-right text-xs text-slate-500">
                                libre: {DAY_LABELS[worker.offDays[cycleWeekIndex]]}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Estado actual</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    analysis.feasible
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {analysis.feasible ? "Factible" : "Con alertas"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Racha maxima</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {analysis.maxConsecutiveOverall}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Domingos max</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {analysis.maxWorkedSundays} / {analysis.maxAllowedWorkedSundays}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Min presentes</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {analysis.minTotalOnDuty}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Errores</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{errors.length}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Lectura operativa</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {analysis.feasible
                  ? "La configuracion actual respeta cobertura base, domingos y racha maxima para el ciclo de 4 semanas."
                  : "La configuracion actual ya muestra al menos una ruptura dura. Usa las alertas para ver exactamente donde se cae."}
              </p>
              <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                {viewMode === "month"
                  ? `Mes real: ${analysis.totalSundaysInScope} domingo(s) en el mes, maximo permitido trabajado por persona ${analysis.maxAllowedWorkedSundays}.`
                  : `Ciclo base: 4 domingos visibles, maximo trabajado por persona ${analysis.maxAllowedWorkedSundays}.`}
              </div>
              <div className="mt-4 space-y-3">
                {analysis.violations.length === 0 ? (
                  <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                    Sin alertas duras en este ciclo. Aun asi, valida el mes real si tendra 5 domingos o cambios de borde entre meses.
                  </div>
                ) : (
                  analysis.violations.map((violation, index) => (
                    <div
                      key={`${violation.type}-${index}`}
                      className={`rounded-2xl px-3 py-3 text-sm ${
                        violation.severity === "error"
                          ? "bg-rose-50 text-rose-700"
                          : violation.severity === "warning"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="font-semibold">{violation.title}</div>
                      <div className="mt-1 leading-6">{violation.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Resumen por trabajador</h3>
              <div className="mt-4 space-y-3">
                {analysis.workerMetrics.map((worker) => (
                  <div
                    key={worker.workerId}
                    className={`rounded-2xl border px-3 py-3 ${
                      worker.maxConsecutive > 6 || worker.workedSundays > 2
                        ? "border-rose-200 bg-rose-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{worker.label}</div>
                        <div className="text-xs text-slate-500">{worker.group}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>Domingos trabajados: {worker.workedSundays}</div>
                        <div>Racha maxima: {worker.maxConsecutive}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
