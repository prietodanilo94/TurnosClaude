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

function roleCellClass(role: "APE" | "CIE", isOff: boolean, isSunday: boolean) {
  if (isOff) {
    return isSunday
      ? "border-rose-300 bg-white text-rose-700 border-dashed"
      : "border-slate-300 bg-white text-slate-500 border-dashed";
  }

  if (role === "APE") {
    return isSunday
      ? "border-sky-300 bg-sky-600 text-white"
      : "border-sky-300 bg-sky-500 text-white";
  }

  return isSunday
    ? "border-amber-300 bg-amber-600 text-white"
    : "border-amber-300 bg-amber-500 text-white";
}

function verdictClass(tone: "bad" | "warn" | "good") {
  if (tone === "bad") return "bg-rose-100 text-rose-700";
  if (tone === "warn") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}

function schemeLabel(scheme: FactibilityOption["scheme"]) {
  return scheme === "fijo" ? "Patron fijo" : "Patron rotativo";
}

function monthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(Date.UTC(year || 2026, ((month || 1) - 1), 1, 12, 0, 0));
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildStatusMessage(feasible: boolean) {
  if (feasible) {
    return {
      title: "Cumple las reglas base",
      detail:
        "Esta propuesta cubre apertura y cierre todos los dias visibles, no supera 6 dias seguidos y mantiene los domingos dentro del limite.",
    };
  }

  return {
    title: "Tiene problemas que revisar",
    detail:
      "Al menos una regla se rompe. Mira las alertas para ver si el problema viene por cobertura, por demasiados domingos o por una racha larga de trabajo.",
  };
}

function recommendationClass(tone: "good" | "warn" | "bad") {
  if (tone === "bad") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function buildRecommendation(
  option: FactibilityOption,
  analysis: ReturnType<typeof analyzeFactibilityOption>,
  viewMode: FactibilityView["mode"]
) {
  const coverageErrors = analysis.violations.filter((item) => item.type === "coverage").length;
  const consecutiveErrors = analysis.violations.filter(
    (item) => item.type === "consecutive"
  ).length;
  const sundayErrors = analysis.violations.filter((item) => item.type === "sundays").length;
  const isTight =
    analysis.maxConsecutiveOverall >= 6 ||
    analysis.maxWorkedSundays >= analysis.maxAllowedWorkedSundays ||
    analysis.minTotalOnDuty <= 2;

  if (!analysis.feasible) {
    let mainProblem = "rompe al menos una regla base";
    let firstAction = "Usa las alertas rojas para corregir el punto que se cae primero.";

    if (coverageErrors > 0) {
      mainProblem = "se cae por cobertura en uno o mas dias";
      firstAction =
        "Antes de seguir comparando comodidad, recupera al menos 1 apertura y 1 cierre por dia.";
    } else if (consecutiveErrors > 0) {
      mainProblem = "deja a una o mas personas con mas de 6 dias seguidos";
      firstAction = "Mueve los libres para cortar la racha antes de seguir iterando.";
    } else if (sundayErrors > 0) {
      mainProblem = "carga demasiados domingos en una o mas personas";
      firstAction = "Reparte mejor los domingos, sobre todo si estas mirando un mes real.";
    }

    return {
      tone: "bad" as const,
      title: "No la recomendaria asi",
      detail: `En su estado actual, esta opcion ${mainProblem}.`,
      bullets: [
        firstAction,
        viewMode === "month"
          ? "Valida la correccion en el mismo mes real para no arreglar una semana y romper otra."
          : "Despues de ajustar, cambia a Mes real para confirmar que el mes calendario tambien siga sano.",
        option.scheme === "rotativo"
          ? "Si el rotativo sigue cayendose, compara contra el patron fijo para entender si el problema es de reparto o de dotacion."
          : "Si el patron fijo sigue cayendose, prueba la opcion rotativa para ver si mejora el reparto de carga.",
      ],
    };
  }

  if (isTight) {
    return {
      tone: "warn" as const,
      title: option.recommended
        ? "La recomendaria, pero con cuidado"
        : "Puede servir, pero esta justa",
      detail:
        "La opcion pasa las reglas base, pero queda cerca del limite en al menos una dimension importante.",
      bullets: [
        analysis.maxConsecutiveOverall >= 6
          ? "La mayor racha ya toca el limite de 6 dias, asi que cualquier cambio de libre hay que revisarlo con cuidado."
          : "La racha de trabajo esta controlada, pero conviene no mover libres sin volver a mirar el panel.",
        analysis.maxWorkedSundays >= analysis.maxAllowedWorkedSundays
          ? "Los domingos ya estan al tope permitido; un mes con mas tension puede romper facil."
          : "Los domingos todavia estan dentro de rango, pero no sobra tanto margen como para improvisar.",
        viewMode === "month"
          ? "Si esta opcion les gusta al equipo, usala como base y evita cambios manuales grandes dentro del mismo mes."
          : "Antes de decidir, mirala en Mes real para confirmar que el calendario verdadero no apriete mas de la cuenta.",
      ],
    };
  }

  return {
    tone: "good" as const,
    title: option.recommended
      ? "La recomendaria como base para conversar con el equipo"
      : "Es una alternativa sana para comparar",
    detail:
      option.scheme === "rotativo"
        ? "Reparte mejor la carga entre personas sin perder la lectura operativa de la cobertura."
        : "Es ordenada, facil de explicar y sirve como patron simple para comparar contra otras alternativas.",
    bullets: [
      "No muestra quiebres duros en cobertura, domingos ni dias consecutivos con la configuracion visible.",
      option.scheme === "rotativo"
        ? "Es buena si la conversacion principal es justicia del patron y reparto de turnos."
        : "Es buena si la prioridad es que el equipo entienda rapido quien abre y quien cierra.",
      viewMode === "month"
        ? "Si quieren seguir iterando, este mismo mes real ya sirve como base razonable para la conversacion."
        : "Si quieren tomar una decision final, denle una ultima mirada en Mes real antes de cerrar.",
    ],
  };
}

function workerWeekHours(
  worker: FactibilityWorkerTemplate,
  cycleWeekIndex: number,
  coverageForWeek: FactibilityCoverageCell[]
) {
  const workedDays = coverageForWeek.filter(
    (cell) => worker.offDays[cycleWeekIndex] !== cell.day
  ).length;

  return {
    workedDays,
    laborHours: workedDays * LABOR_HOURS_PER_DAY,
    presenceHours: workedDays * PRESENCE_HOURS_PER_DAY,
  };
}

function weekHoursSummary(
  coverageForWeek: FactibilityCoverageCell[],
  workers: FactibilityWorkerTemplate[]
) {
  const apeLaborHours = coverageForWeek.reduce(
    (sum, cell) => sum + cell.apeOnDuty * LABOR_HOURS_PER_DAY,
    0
  );
  const cieLaborHours = coverageForWeek.reduce(
    (sum, cell) => sum + cell.cieOnDuty * LABOR_HOURS_PER_DAY,
    0
  );
  const totalLaborHours = apeLaborHours + cieLaborHours;
  const totalPresenceHours = coverageForWeek.reduce(
    (sum, cell) => sum + cell.totalOnDuty * PRESENCE_HOURS_PER_DAY,
    0
  );
  const averageHours =
    workers.length === 0 ? 0 : Math.round((totalLaborHours / workers.length) * 10) / 10;
  const apeShare = totalLaborHours === 0 ? 0 : (apeLaborHours / totalLaborHours) * 100;

  return {
    apeLaborHours,
    cieLaborHours,
    totalLaborHours,
    totalPresenceHours,
    averageHours,
    apeShare,
  };
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

function roleWindow(role: "APE" | "CIE") {
  return role === "APE" ? { start: 10, end: 18 } : { start: 12, end: 20 };
}

function dayPresenceSummary(cell: FactibilityCoverageCell, workers: FactibilityWorkerTemplate[]) {
  const assignments = workers
    .map((worker) => {
      const isOff = worker.offDays[cell.cycleWeekIndex] === cell.day;
      if (isOff) {
        return {
          workerId: worker.id,
          label: worker.label,
          group: worker.group,
          status: "off" as const,
        };
      }

      const role = worker.weeklyRoles[cell.cycleWeekIndex];
      return {
        workerId: worker.id,
        label: worker.label,
        group: worker.group,
        status: "working" as const,
        role,
        ...roleWindow(role),
      };
    })
    .sort((left, right) => {
      if (left.status === "off" && right.status === "working") return 1;
      if (left.status === "working" && right.status === "off") return -1;
      if (left.status === "working" && right.status === "working") {
        if (left.start !== right.start) return left.start - right.start;
      }
      return left.label.localeCompare(right.label);
    });

  return {
    assignments,
    overlapPeople: cell.totalOnDuty,
  };
}

export function FactibilidadPageClient() {
  const scenarios = useMemo(() => getFactibilityScenarios(), []);
  const [headcount, setHeadcount] = useState(6);
  const [viewMode, setViewMode] = useState<FactibilityView["mode"]>("month");
  const [monthValue, setMonthValue] = useState("2026-05");
  const [showHelp, setShowHelp] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

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
  const statusMessage = buildStatusMessage(analysis.feasible);
  const recommendation = buildRecommendation(selectedOption, analysis, viewMode);
  const periodCells = analysis.coverageCells.filter((cell) => cell.inMonth);
  const summaryScopeLabel = viewMode === "month" ? "Resumen del mes" : "Resumen del ciclo visible";
  const activeModeLabel = viewMode === "month" ? `Mes real: ${monthLabel(monthValue)}` : "Ciclo base";
  const recommendationScope =
    viewMode === "month"
      ? `Esta conclusion habla de ${scenario.title}, opcion ${selectedOption.title}, en mes real ${monthLabel(monthValue)}.`
      : `Esta conclusion habla de ${scenario.title}, opcion ${selectedOption.title}, en el ciclo base de 4 semanas.`;
  const scenarioContextLine = `${scenario.baselineAnalysis} ${scenario.fifthSundayNote}`;
  const periodWorkerSummary = workers.map((worker) =>
    workerPeriodSummary(worker, periodCells, analysis.maxAllowedWorkedSundays)
  );
  const periodLaborHours = periodWorkerSummary.reduce((sum, worker) => sum + worker.laborHours, 0);
  const periodPresenceHours = periodWorkerSummary.reduce(
    (sum, worker) => sum + worker.presenceHours,
    0
  );
  const selectableCells = analysis.coverageCells.filter((cell) => cell.inMonth);

  useEffect(() => {
    if (selectableCells.length === 0) {
      setSelectedDate("");
      return;
    }

    if (!selectableCells.some((cell) => cell.date === selectedDate)) {
      setSelectedDate(selectableCells[0].date);
    }
  }, [selectableCells, selectedDate]);

  const selectedDayCell =
    selectableCells.find((cell) => cell.date === selectedDate) ?? selectableCells[0];
  const selectedDaySummary = selectedDayCell
    ? dayPresenceSummary(selectedDayCell, workers)
    : null;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-6 p-6">
        <section className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_38%),linear-gradient(135deg,#0f172a_0%,#111827_52%,#1e293b_100%)] px-6 py-8 text-white shadow-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-sky-200">Mall 7 dias</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Analizador visual de factibilidad
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Compara opciones de turnos para una sucursal que abre 7 dias, mueve los libres
                semana a semana y mira al instante si la propuesta sigue siendo sana o si se rompe
                por cobertura, domingos o exceso de dias seguidos.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              <button
                onClick={() => setShowHelp((value) => !value)}
                className="self-start rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/20 xl:self-end"
              >
                {showHelp ? "Cerrar ayuda" : "Como usar?"}
              </button>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-xs uppercase tracking-wide text-slate-300">Apertura</div>
                  <div className="mt-1 text-lg font-semibold">{ROLE_DESCRIPTIONS.APE}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-xs uppercase tracking-wide text-slate-300">Cierre</div>
                  <div className="mt-1 text-lg font-semibold">{ROLE_DESCRIPTIONS.CIE}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-xs uppercase tracking-wide text-slate-300">
                    Reglas revisadas
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    Cobertura, domingos y 6 dias seguidos
                  </div>
                </div>
              </div>
            </div>
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
                      Parte eligiendo cuantas personas quieres analizar: N=4, N=5, N=6 y asi
                      sucesivamente.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paso 2
                    </div>
                    <div className="mt-1 font-medium text-slate-900">Compara el patron</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Revisa si te conviene mas la opcion fija o la rotativa antes de ajustar dias
                      libres.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paso 3
                    </div>
                    <div className="mt-1 font-medium text-slate-900">Haz cambios y compara</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Haz clic en una celda para cambiar el libre de esa semana y mira de inmediato
                      si aparece un problema.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">Leyenda rapida</h2>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Libre</span>
                  <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">
                    Apertura 10:00-18:00
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                    Cierre 12:00-20:00
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">
                    Dia bien cubierto
                  </span>
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700">
                    Falta cobertura o se rompe una regla
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Cuando una semana aparece en rojo, no significa solo que falte gente: tambien
                  puede significar demasiados domingos o mas de 6 dias seguidos para una persona.
                </p>
              </div>
            </div>
          </section>
        )}

        <section
          className={`rounded-[24px] border-2 px-6 py-4 ${
            analysis.feasible ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`text-2xl font-bold ${
                analysis.feasible ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {analysis.feasible ? "Cumple las reglas" : "Tiene problemas"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              {errors.length} {errors.length === 1 ? "error" : "errores"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Racha max: {analysis.maxConsecutiveOverall} dias
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Domingos: {analysis.maxWorkedSundays}/{analysis.maxAllowedWorkedSundays}
            </span>
            <span className="ml-auto text-sm text-slate-500">
              {scenario.title} · {selectedOption.title} · {activeModeLabel}
            </span>
          </div>
        </section>

        <section className="rounded-[20px] bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {scenario.title}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${verdictClass(
                  scenario.verdictTone
                )}`}
              >
                {scenario.verdict}
              </span>
              <span className="text-slate-500">{selectedOption.headline}</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">{scenarioContextLine}</p>
            {scenario.mixedOutlook && (
              <p className="text-sm leading-6 text-slate-500">{scenario.mixedOutlook}</p>
            )}
          </div>
        </section>

        <div className="sticky top-0 z-20 rounded-[20px] bg-white/90 px-5 py-3 shadow-md ring-1 ring-slate-200 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dotacion
              </span>
              <div className="ml-2 flex gap-1">
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
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Patron
              </span>
              <div className="ml-2 inline-flex rounded-full bg-slate-100 p-0.5">
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
                  </button>
                ))}
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista
              </span>
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
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">{scenario.verdict}</span>
              <button
                onClick={resetOption}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-5">
            {weeks.map((coverageForWeek, weekIndex) => {
              const cycleWeekIndex = coverageForWeek[0]?.cycleWeekIndex ?? 0;
              const weekSummary = weekHoursSummary(coverageForWeek, workers);

              return (
                <div
                  key={weekIndex}
                  className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {viewMode === "month"
                            ? `Semana visible ${weekIndex + 1}`
                            : `Semana ${weekIndex + 1}`}
                        </h3>
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Editable
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Haz clic en una celda para cambiar el libre. Esta semana hereda la logica
                        de la semana {cycleWeekIndex + 1} del ciclo base.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {coverageForWeek.map((cell) => (
                        <button
                          key={cell.date}
                          onClick={() => setSelectedDate(cell.date)}
                          title="Ver detalle horario del dia"
                          className={`rounded-full px-3 py-1 font-semibold transition ${
                            selectedDate === cell.date ? "ring-2 ring-slate-900 ring-offset-1" : ""
                          } ${
                            cell.meetsBaseCoverage
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {DAY_LABELS[cell.day]} {cell.date.slice(8, 10)} · {cell.apeOnDuty}A/
                          {cell.cieOnDuty}C
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 border-b border-slate-200 bg-white/80 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Horas laborales del equipo esta semana</span>
                        <span>{weekSummary.totalLaborHours}h</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div className="flex h-full w-full">
                          <div
                            className="bg-sky-500"
                            style={{ width: `${weekSummary.apeShare}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${100 - weekSummary.apeShare}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                          Apertura: {weekSummary.apeLaborHours}h
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-800">
                          Cierre: {weekSummary.cieLaborHours}h
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                          Presencia total: {weekSummary.totalPresenceHours}h
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Promedio por persona
                        </div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">
                          {weekSummary.averageHours}h
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Meta esperada
                        </div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">42h</div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3">Persona</th>
                          {FACTIBILITY_WEEKDAYS.map((day) => (
                            <th key={day} className="px-3 py-3 text-center">
                              {DAY_LABELS[day]}
                            </th>
                          ))}
                          <th className="px-5 py-3 text-right">Libre / horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map((worker) => {
                          const role = worker.weeklyRoles[cycleWeekIndex];
                          const isWorkerFlagged = workerErrorIds.has(worker.id);
                          const hours = workerWeekHours(worker, cycleWeekIndex, coverageForWeek);

                          return (
                            <tr
                              key={`${worker.id}-${weekIndex}`}
                              className={isWorkerFlagged ? "bg-rose-50/70" : "bg-white"}
                            >
                              <td className="px-5 py-3 align-top">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-900">{worker.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {worker.group} | {ROLE_LABELS[role]}
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
                                      title={`Cambiar libre semanal a ${DAY_LABELS[day]}`}
                                      className={`w-24 rounded-2xl border px-3 py-2 text-[11px] font-semibold leading-tight transition hover:-translate-y-0.5 ${
                                        dateCell?.inMonth ? "" : "opacity-50"
                                      } ${roleCellClass(role, isOff, day === "domingo")}`}
                                    >
                                      {isOff ? "Libre" : role === "APE" ? "Apert." : "Cierre"}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="px-5 py-3 text-right text-xs text-slate-500">
                                <div className="flex flex-col items-end gap-1">
                                  <span>{DAY_LABELS[worker.offDays[cycleWeekIndex]]}</span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 font-semibold ${
                                      hours.laborHours === 42
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {hours.laborHours}h lab
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                                    {hours.presenceHours}h pres
                                  </span>
                                </div>
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
            {selectedDayCell && selectedDaySummary && (
              <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Vista del dia seleccionado</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {selectedDayCell.date} · {DAY_LABELS[selectedDayCell.day]}. Aqui ves a que hora
                  entra cada persona y en que tramo coinciden.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                    Apertura: {selectedDayCell.apeOnDuty}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-800">
                    Cierre: {selectedDayCell.cieOnDuty}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                    Juntos entre 12:00 y 18:00: {selectedDaySummary.overlapPeople} personas
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="grid grid-cols-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>10:00</span>
                    <span className="text-center">12:00</span>
                    <span className="text-center">14:00</span>
                    <span className="text-center">16:00</span>
                    <span className="text-center">18:00</span>
                    <span className="text-right">20:00</span>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {selectedDaySummary.assignments.map((assignment) => (
                    <div
                      key={assignment.workerId}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{assignment.label}</div>
                          <div className="text-xs text-slate-500">{assignment.group}</div>
                        </div>
                        {assignment.status === "working" ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              assignment.role === "APE"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ROLE_LABELS[assignment.role]} {assignment.start}:00-{assignment.end}:00
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Libre
                          </span>
                        )}
                      </div>

                      {assignment.status === "working" ? (
                        <div className="mt-3">
                          <div className="relative h-8 rounded-full bg-white ring-1 ring-slate-200">
                            <div
                              className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-full px-3 text-[11px] font-semibold leading-5 ${
                                assignment.role === "APE"
                                  ? "bg-sky-500 text-white"
                                  : "bg-amber-500 text-white"
                              }`}
                              style={{
                                left: `${(assignment.start - 10) * 10}%`,
                                width: `${(assignment.end - assignment.start) * 10}%`,
                              }}
                            >
                              {assignment.start}:00-{assignment.end}:00
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                          Esta persona no trabaja ese dia.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Estado actual</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    analysis.feasible ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {analysis.feasible ? "Cumple" : "Revisar"}
                </span>
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="font-medium text-slate-900">{statusMessage.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{statusMessage.detail}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Mayor racha</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {analysis.maxConsecutiveOverall} dias
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Domingos maximos
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {analysis.maxWorkedSundays} / {analysis.maxAllowedWorkedSundays}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Minimo presente
                  </div>
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
              <h3 className="text-base font-semibold text-slate-900">Que significa este resultado</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {analysis.feasible
                  ? "La propuesta actual pasa las reglas base de esta vista. Eso no significa que sea la unica buena opcion, pero si que no muestra quiebres duros con los datos visibles."
                  : "La propuesta actual ya muestra un problema concreto. La lista de alertas te dice exactamente si el quiebre viene por cobertura, domingos o por demasiados dias seguidos."}
              </p>
              <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                {viewMode === "month"
                  ? `Mes real: este calendario tiene ${analysis.totalSundaysInScope} domingo(s). En esta vista, cada persona deberia trabajar como maximo ${analysis.maxAllowedWorkedSundays}.`
                  : `Ciclo base: estas viendo 4 semanas tipo. En este ciclo, cada persona deberia trabajar como maximo ${analysis.maxAllowedWorkedSundays} domingos.`}
              </div>
              <div className="mt-4 space-y-3">
                {analysis.violations.length === 0 ? (
                  <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                    No aparecen problemas duros en esta configuracion. Igual conviene mirar Mes
                    real cuando el calendario tenga 5 domingos o semanas cortadas por el cambio de
                    mes.
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
          </aside>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{summaryScopeLabel}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Muestra cuantos dias trabaja cada persona en el periodo visible y cuantas horas
                laborales y de presencia acumula.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
                Horas laborales equipo: {periodLaborHours}h
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                Presencia total equipo: {periodPresenceHours}h
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4">Persona</th>
                  <th className="px-4 py-3 text-center">Dias trab.</th>
                  <th className="px-4 py-3 text-center">Libres</th>
                  <th className="px-4 py-3 text-center">APE</th>
                  <th className="px-4 py-3 text-center">CIE</th>
                  <th className="px-4 py-3 text-right">Hrs lab.</th>
                  <th className="px-4 py-3 text-center">Domingos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodWorkerSummary.map((worker) => (
                  <tr key={worker.workerId} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900">{worker.label}</div>
                      <div className="text-xs text-slate-500">{worker.group}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">
                      {worker.workedDays}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{worker.offDays}</td>
                    <td className="px-4 py-3 text-center text-sky-700">{worker.apeDays}</td>
                    <td className="px-4 py-3 text-center text-amber-700">{worker.cieDays}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {worker.laborHours}h
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex gap-0.5">
                        {Array.from({ length: analysis.totalSundaysInScope }).map((_, index) => (
                          <span
                            key={index}
                            className={`h-2.5 w-2.5 rounded-full ${
                              index < worker.sundayWork ? "bg-amber-400" : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </span>
                      <div
                        className={`mt-0.5 text-xs font-semibold ${
                          worker.sundayWork > worker.sundayLimit ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {worker.sundayWork}/{worker.sundayLimit}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Conclusion recomendada para esta opcion
          </h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
              {scenario.title}
            </span>
            <span className="rounded-full bg-sky-100 px-3 py-1.5 font-semibold text-sky-800">
              {selectedOption.title}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
              {schemeLabel(selectedOption.scheme)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
              {activeModeLabel}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{recommendationScope}</p>
          <div
            className={`mt-3 rounded-2xl border px-4 py-4 ${recommendationClass(recommendation.tone)}`}
          >
            <div className="font-semibold">{recommendation.title}</div>
            <p className="mt-2 text-sm leading-6">{recommendation.detail}</p>
          </div>
          <div className="mt-3 space-y-2">
            {recommendation.bullets.map((bullet) => (
              <div
                key={bullet}
                className="rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700"
              >
                {bullet}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
