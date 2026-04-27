"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeFactibilityOption } from "@/lib/factibilidad/analyzer";
import { getFactibilityScenarios } from "@/lib/factibilidad/scenarios";
import {
  FACTIBILITY_WEEKDAYS,
  type FactibilityCoverageCell,
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

const ROLE_LABELS = {
  APE: "Apertura",
  CIE: "Cierre",
} as const;

const ROLE_DESCRIPTIONS = {
  APE: "Apertura 10:00-18:00",
  CIE: "Cierre 12:00-20:00",
} as const;

const LABOR_HOURS_PER_DAY = 7;
const PRESENCE_HOURS_PER_DAY = 8;

function cloneWorkers(workers: FactibilityWorkerTemplate[]): FactibilityWorkerTemplate[] {
  return workers.map((worker) => ({
    ...worker,
    weeklyRoles: [...worker.weeklyRoles],
    offDays: [...worker.offDays],
  }));
}

function schemeLabel(scheme: FactibilityOption["scheme"]) {
  return scheme === "fijo" ? "Patron fijo" : "Patron rotativo";
}

function groupExplanation(option: FactibilityOption) {
  if (option.scheme === "fijo") {
    return {
      title: "Como leer los grupos en esta opcion",
      detail:
        "Aqui no hay grupos rotando entre semanas. Las personas con prefijo APE quedan siempre en apertura y las personas con prefijo CIE quedan siempre en cierre.",
      bullets: [
        "APE-1, APE-2, etc. = personas que trabajan siempre en apertura.",
        "CIE-1, CIE-2, etc. = personas que trabajan siempre en cierre.",
        "El numero solo identifica a cada persona dentro de su bloque.",
      ],
    };
  }

  return {
    title: "Como leer los grupos en esta opcion",
    detail:
      "Aqui si hay dos grupos que se van alternando por semana para repartir mejor la carga entre apertura y cierre.",
    bullets: [
      "G1 = Grupo 1 y G2 = Grupo 2.",
      "Semanas 1 y 3: G1 abre y G2 cierra.",
      "Semanas 2 y 4: G1 cierra y G2 abre.",
    ],
  };
}

function monthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, 1, 12, 0, 0));
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function workerPeriodSummary(
  worker: FactibilityWorkerTemplate,
  cells: FactibilityCoverageCell[],
  sundayLimit: number
) {
  let workedDays = 0;
  let apeDays = 0;
  let cieDays = 0;

  for (const cell of cells) {
    const isOff = worker.offDays[cell.cycleWeekIndex] === cell.day;
    if (isOff) continue;

    workedDays += 1;
    if (worker.weeklyRoles[cell.cycleWeekIndex] === "APE") apeDays += 1;
    if (worker.weeklyRoles[cell.cycleWeekIndex] === "CIE") cieDays += 1;
  }

  const laborHours = workedDays * LABOR_HOURS_PER_DAY;
  const presenceHours = workedDays * PRESENCE_HOURS_PER_DAY;
  const sundayWork = cells.filter(
    (cell) => cell.day === "domingo" && worker.offDays[cell.cycleWeekIndex] !== cell.day
  ).length;

  return {
    workerId: worker.id,
    label: worker.label,
    group: worker.group,
    workedDays,
    offDays: cells.length - workedDays,
    apeDays,
    cieDays,
    laborHours,
    presenceHours,
    sundayWork,
    sundayLimit,
  };
}

export function FactibilidadPageClient() {
  const scenarios = useMemo(() => getFactibilityScenarios(), []);
  const [headcount, setHeadcount] = useState(6);
  const [viewMode, setViewMode] = useState<FactibilityView["mode"]>("month");
  const [monthValue, setMonthValue] = useState("2026-05");
  const [showHelp, setShowHelp] = useState(false);

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

  const recommendedOption = useMemo(
    () => scenario.options.find((item) => item.recommended) ?? scenario.options[0],
    [scenario]
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

  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    setShowAlerts(!analysis.feasible);
  }, [analysis.feasible]);

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
  const scenarioContextLine = `${scenario.baselineAnalysis} ${scenario.fifthSundayNote}`;
  const groupsCopy = groupExplanation(selectedOption);
  const periodCells = analysis.coverageCells.filter((cell) => cell.inMonth);
  const visiblePeriodCells =
    periodCells.length > 0 ? periodCells : analysis.coverageCells.filter((cell) => cell.inMonth);
  const summaryCells = visiblePeriodCells.length > 0 ? visiblePeriodCells : analysis.coverageCells;
  const periodWorkerSummary = workers.map((worker) =>
    workerPeriodSummary(worker, summaryCells, analysis.maxAllowedWorkedSundays)
  );
  const periodLaborHours = periodWorkerSummary.reduce((sum, worker) => sum + worker.laborHours, 0);
  const periodPresenceHours = periodWorkerSummary.reduce(
    (sum, worker) => sum + worker.presenceHours,
    0
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-4 p-6">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_38%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#1e293b_100%)] px-6 py-8 text-white shadow-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-sky-200">Mall 7 dias</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Calendario mensual de opciones de turnos
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Elige una dotacion y un patron, y mira de inmediato como se veria el mes completo
                del equipo. La idea es poder conversar opciones reales con una vista clara de quien
                abre, quien cierra y donde aparecen problemas.
              </p>
            </div>
            <button
              onClick={() => setShowHelp((value) => !value)}
              className="self-start rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/20"
            >
              {showHelp ? "Cerrar ayuda" : "Como usar?"}
            </button>
          </div>
        </section>

        {showHelp && (
          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Como usar esta vista</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paso 1
                    </div>
                    <div className="mt-1 font-medium text-slate-900">Elige la dotacion</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Prueba con N=4, N=5, N=6 y asi sucesivamente para ver con cuanta gente se
                      sostiene el mes.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paso 2
                    </div>
                    <div className="mt-1 font-medium text-slate-900">Compara el patron</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Cambia entre fijo y rotativo para ver cual le conviene mas a la operacion y
                      al equipo.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paso 3
                    </div>
                    <div className="mt-1 font-medium text-slate-900">Ajusta un libre</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Haz clic en una celda del calendario para mover el libre semanal de esa
                      persona y revisar si la opcion sigue sana.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">Leyenda rapida</h2>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">
                    Apertura 10:00-18:00
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                    Cierre 12:00-20:00
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">Libre</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">
                    Cobertura OK
                  </span>
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700">
                    Falta cobertura
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  La fila final del calendario muestra si cada dia queda bien cubierto. Si algo se
                  pone rojo, revisa las alertas de abajo para ver si el problema viene por
                  cobertura, domingos o dias consecutivos.
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="sticky top-0 z-20 rounded-[20px] bg-white/95 px-5 py-3 shadow-md ring-1 ring-slate-200 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">N</span>
            <div className="flex gap-1">
              {scenarios.map((item) => (
                <button
                  key={item.headcount}
                  onClick={() => setHeadcount(item.headcount)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    item.headcount === scenario.headcount
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.headcount}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patron
            </span>
            <div className="inline-flex rounded-full bg-slate-100 p-0.5">
              {scenario.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setOptionId(option.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    option.id === selectedOption.id
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.scheme === "fijo" ? "Fijo" : "Rotativo"}
                  {option.recommended ? (
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        option.id === selectedOption.id
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      Recomendada
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <div className="inline-flex rounded-full bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode("cycle")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "cycle"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                Ciclo base
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "month"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                Mes real
              </button>
            </div>

            {viewMode === "month" && (
              <input
                type="month"
                value={monthValue}
                onChange={(event) => setMonthValue(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
              />
            )}

            <div className="ml-auto flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  analysis.feasible
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {analysis.feasible ? "Cumple" : `${errors.length} error${errors.length !== 1 ? "es" : ""}`}
              </span>
              <button
                onClick={resetOption}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>

        <section className="rounded-[20px] bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{groupsCopy.title}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedOption.roleCountsLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{groupsCopy.detail}</p>
            </div>
            <div className="grid gap-2 text-sm text-slate-700">
              {groupsCopy.bullets.map((bullet) => (
                <div key={bullet} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {viewMode === "month"
                    ? `Distribucion de ${monthLabel(monthValue)}`
                    : "Patron ciclo base (4 semanas)"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {scenario.title} · {selectedOption.title} · {schemeLabel(selectedOption.scheme)}
                  {selectedOption.recommended ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Recomendada
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{scenarioContextLine}</p>
                {scenario.mixedOutlook ? (
                  <p className="mt-1 text-sm leading-6 text-slate-500">{scenario.mixedOutlook}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                  A Apertura 10:00-18:00
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-800">
                  C Cierre 12:00-20:00
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
                  L Libre
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[160px] bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                    Persona
                  </th>
                  {analysis.coverageCells.map((cell) => (
                    <th
                      key={cell.date}
                      className={`min-w-[48px] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide ${
                        cell.day === "domingo"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-white text-slate-400"
                      } ${!cell.inMonth ? "opacity-40" : ""}`}
                    >
                      <div>{DAY_LABELS[cell.day].slice(0, 1)}</div>
                      <div className="font-bold text-slate-700">{cell.date.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((worker) => {
                  const isWorkerFlagged = workerErrorIds.has(worker.id);

                  return (
                    <tr
                      key={worker.id}
                      className={isWorkerFlagged ? "bg-rose-50/60" : "hover:bg-slate-50/60"}
                    >
                      <td
                        className={`sticky left-0 z-10 px-4 py-2 shadow-[2px_0_4px_rgba(0,0,0,0.06)] ${
                          isWorkerFlagged ? "bg-rose-50" : "bg-white"
                        }`}
                      >
                        <div className="font-medium text-slate-900">{worker.label}</div>
                        <div className="text-[11px] text-slate-500">{worker.group}</div>
                      </td>
                      {analysis.coverageCells.map((cell) => {
                        const isOff = worker.offDays[cell.cycleWeekIndex] === cell.day;
                        const role = worker.weeklyRoles[cell.cycleWeekIndex];
                        const isSunday = cell.day === "domingo";

                        return (
                          <td
                            key={`${worker.id}-${cell.date}`}
                            className={`px-1 py-1.5 text-center ${!cell.inMonth ? "opacity-30" : ""} ${
                              isSunday ? "bg-slate-50" : ""
                            }`}
                          >
                            <button
                              onClick={() => setOffDay(worker.id, cell.cycleWeekIndex, cell.day)}
                              title={
                                isOff
                                  ? "Libre - clic para cambiar"
                                  : `${ROLE_LABELS[role]} - clic para marcar este dia como libre`
                              }
                              className={`w-10 rounded-lg py-1.5 text-[11px] font-bold transition hover:scale-105 hover:shadow-md ${
                                isOff
                                  ? isSunday
                                    ? "bg-rose-100 text-rose-500"
                                    : "bg-slate-100 text-slate-400"
                                  : role === "APE"
                                    ? isSunday
                                      ? "bg-sky-600 text-white"
                                      : "bg-sky-500 text-white"
                                    : isSunday
                                      ? "bg-amber-600 text-white"
                                      : "bg-amber-500 text-white"
                              }`}
                            >
                              {isOff ? "L" : role === "APE" ? "A" : "C"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cobertura
                    </div>
                  </td>
                  {analysis.coverageCells.map((cell) => (
                    <td
                      key={`coverage-${cell.date}`}
                      className={`px-1 py-1.5 text-center ${!cell.inMonth ? "opacity-30" : ""}`}
                    >
                      <div
                        className={`rounded-lg px-1 py-1 text-[10px] font-bold ${
                          !cell.inMonth
                            ? "text-slate-300"
                            : cell.meetsBaseCoverage
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-200 text-rose-700"
                        }`}
                      >
                        {cell.apeOnDuty}A
                        <br />
                        {cell.cieOnDuty}C
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Haz clic en cualquier celda para mover el dia libre de esa persona dentro de esa semana
            del ciclo.
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mes por persona</h2>
              <p className="mt-1 text-sm text-slate-500">
                Asi se ve el periodo visible para cada integrante del equipo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                Horas laborales equipo: {periodLaborHours}h
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                Presencia total equipo: {periodPresenceHours}h
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-800">
                Domingos visibles: {analysis.totalSundaysInScope}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workers.map((worker) => {
              const isWorkerFlagged = workerErrorIds.has(worker.id);
              const summary = workerPeriodSummary(worker, summaryCells, analysis.maxAllowedWorkedSundays);

              return (
                <div
                  key={worker.id}
                  className={`overflow-hidden rounded-[20px] border ${
                    isWorkerFlagged ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`px-4 py-3 ${isWorkerFlagged ? "bg-rose-100" : "bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{worker.label}</div>
                        <div className="text-xs text-slate-500">{worker.group}</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          worker.weeklyRoles[0] === "APE"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {schemeLabel(selectedOption.scheme)}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 pt-3">
                    <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
                      {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
                        <div key={day} className="text-[9px] font-semibold uppercase text-slate-400">
                          {day}
                        </div>
                      ))}
                    </div>

                    {weeks.map((coverageForWeek, weekIndex) => {
                      const cycleWeekIndex = coverageForWeek[0]?.cycleWeekIndex ?? 0;

                      return (
                        <div key={`${worker.id}-${weekIndex}`} className="mb-0.5 grid grid-cols-7 gap-0.5">
                          {FACTIBILITY_WEEKDAYS.map((day) => {
                            const cell = coverageForWeek.find((item) => item.day === day);

                            if (!cell) {
                              return <div key={`${worker.id}-${weekIndex}-${day}`} className="h-7 rounded" />;
                            }

                            const isOff = worker.offDays[cycleWeekIndex] === day;
                            const role = worker.weeklyRoles[cycleWeekIndex];
                            const isSunday = day === "domingo";

                            return (
                              <div
                                key={`${worker.id}-${cell.date}`}
                                title={`${cell.date}: ${isOff ? "Libre" : ROLE_DESCRIPTIONS[role]}`}
                                className={`flex h-7 flex-col items-center justify-center rounded text-[9px] font-bold ${
                                  !cell.inMonth
                                    ? "opacity-20"
                                    : isOff
                                      ? isSunday
                                        ? "bg-rose-100 text-rose-500"
                                        : "bg-slate-100 text-slate-400"
                                      : role === "APE"
                                        ? "bg-sky-500 text-white"
                                        : "bg-amber-500 text-white"
                                }`}
                              >
                                <span className="leading-none">{cell.date.slice(8)}</span>
                                <span className="leading-none opacity-80">
                                  {isOff ? "L" : role === "APE" ? "A" : "C"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-3">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      {summary.laborHours}h lab
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {summary.workedDays} dias trab
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">
                      {summary.apeDays} APE
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                      {summary.cieDays} CIE
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        summary.sundayWork > summary.sundayLimit
                          ? "bg-rose-200 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Dom {summary.sundayWork}/{summary.sundayLimit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {analysis.violations.length > 0 ? (
          <section className="rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
            <button
              onClick={() => setShowAlerts((value) => !value)}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">Alertas</h2>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {analysis.violations.length}
                </span>
              </div>
              <span className="text-sm text-slate-500">
                {showAlerts ? "Ocultar" : "Ver detalle"}
              </span>
            </button>

            {showAlerts ? (
              <div className="border-t border-slate-100 px-5 pb-5">
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {analysis.violations.map((violation, index) => (
                    <div
                      key={`${violation.type}-${index}`}
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        violation.severity === "error"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <div className="font-semibold">{violation.title}</div>
                      <div className="mt-0.5 text-xs opacity-80">{violation.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="rounded-[24px] bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            Sin problemas: esta configuracion cumple las reglas visibles para {scenario.title} en{" "}
            {viewMode === "month" ? monthLabel(monthValue) : "el ciclo base"}.
          </div>
        )}
      </div>
    </div>
  );
}
