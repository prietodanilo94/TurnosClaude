import { NextResponse } from "next/server";
import { z } from "zod";
import { runOptimizerLab } from "@/lib/optimizer-lab/engine";
import type {
  LabAssignment,
  LabDay,
  OptimizerLabInput,
  OptimizerLabResponse,
  OptimizerProposal,
  ProposalMetrics,
} from "@/lib/optimizer-lab/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  category: z.enum(["ventas_mall_dominical"]),
  solverMode: z.enum(["heuristic", "cp_sat"]),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  dotation: z.number().int().min(1).max(50),
  weeklyHoursTarget: z.number().int().min(1).max(60),
  maxConsecutiveDays: z.number().int().min(1).max(7),
  minFreeSundays: z.number().int().min(0).max(5),
  numProposals: z.number().int().min(1).max(5),
  timeLimitSeconds: z.number().int().min(5).max(180),
});

const WEEKDAY_LABELS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const COVERAGE_MIN = 2;

type ShiftId = "V_M7_APE" | "V_M7_CIE" | "V_M7_COM" | "OFF";
type ShiftLabel = "APE" | "CIE" | "COM" | "Libre";

type ShiftDef = {
  label: ShiftLabel;
  laborHours: number;
};

type CpSatOptimizeResponse = {
  propuestas?: Array<{
    id: string;
    score: number;
    asignaciones: Array<{
      worker_slot: number;
      date: string;
      shift_id: string;
    }>;
  }>;
  diagnostico?: {
    dotacion_disponible: number;
    dotacion_minima_requerida: number;
    dotacion_suficiente: boolean;
    mensajes: string[];
  };
  detail?: string;
};

const SHIFT_MAP: Record<string, ShiftDef> = {
  V_M7_APE: { label: "APE", laborHours: 8 },
  V_M7_CIE: { label: "CIE", laborHours: 8 },
  V_M7_COM: { label: "COM", laborHours: 9 },
  OFF: { label: "Libre", laborHours: 0 },
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthDates(year: number, month: number) {
  const firstVisible = new Date(year, month - 1, 1);
  const lastVisible = new Date(year, month, 0);

  const effectiveStart = new Date(firstVisible);
  effectiveStart.setDate(firstVisible.getDate() - ((firstVisible.getDay() + 6) % 7));

  const effectiveEnd = new Date(lastVisible);
  effectiveEnd.setDate(lastVisible.getDate() + ((7 - lastVisible.getDay()) % 7));

  const visibleDays: LabDay[] = [];
  const effectiveDays: LabDay[] = [];

  for (let cursor = new Date(effectiveStart); cursor <= effectiveEnd; cursor.setDate(cursor.getDate() + 1)) {
    const iso = toIsoDate(cursor);
    const weekday = WEEKDAY_LABELS[(cursor.getDay() + 6) % 7];
    const day: LabDay = {
      date: iso,
      weekday,
      inVisibleMonth: cursor.getMonth() === month - 1,
      isSunday: weekday === "domingo",
    };
    effectiveDays.push(day);
    if (day.inVisibleMonth) {
      visibleDays.push(day);
    }
  }

  return { visibleDays, effectiveDays };
}

function buildMetrics(
  assignments: LabAssignment[],
  visibleDays: LabDay[],
  effectiveDays: LabDay[],
  weekCount: number,
  dotation: number
): ProposalMetrics {
  const visibleDateSet = new Set(visibleDays.map((day) => day.date));
  const dayByDate = new Map(visibleDays.map((day) => [day.date, day]));

  const shiftCounts: Record<string, number> = {
    V_M7_APE: 0,
    V_M7_CIE: 0,
    V_M7_COM: 0,
  };
  const coverageByDate: Record<string, number> = {};
  const effectiveCoverageByDate: Record<string, number> = {};
  const slotHours: Record<string, number> = {};
  const weeklyHoursBySlot: Record<string, number[]> = {};
  const freeSundaysBySlot = new Map<number, number>();

  for (let slot = 1; slot <= dotation; slot += 1) {
    slotHours[String(slot)] = 0;
    weeklyHoursBySlot[String(slot)] = Array.from({ length: weekCount }, () => 0);
    freeSundaysBySlot.set(slot, 0);
  }

  effectiveDays.forEach((day) => {
    effectiveCoverageByDate[day.date] = 0;
    if (day.inVisibleMonth) {
      coverageByDate[day.date] = 0;
    }
  });

  assignments.forEach((assignment) => {
    if (!assignment.isOff) {
      effectiveCoverageByDate[assignment.date] = (effectiveCoverageByDate[assignment.date] ?? 0) + 1;
    }

    weeklyHoursBySlot[String(assignment.slotNumber)][assignment.weekIndex] += assignment.laborHours;

    if (!visibleDateSet.has(assignment.date)) {
      return;
    }

    if (!assignment.isOff) {
      shiftCounts[assignment.shiftId] = (shiftCounts[assignment.shiftId] ?? 0) + 1;
      coverageByDate[assignment.date] = (coverageByDate[assignment.date] ?? 0) + 1;
    }

    slotHours[String(assignment.slotNumber)] += assignment.laborHours;

    const day = dayByDate.get(assignment.date);
    if (day?.isSunday && assignment.isOff) {
      freeSundaysBySlot.set(
        assignment.slotNumber,
        (freeSundaysBySlot.get(assignment.slotNumber) ?? 0) + 1
      );
    }
  });

  const freeSundays = Array.from(freeSundaysBySlot.values());
  const totalHours = Object.values(slotHours).reduce((sum, value) => sum + value, 0);
  const effectiveCoverageValues = effectiveDays.map((day) => effectiveCoverageByDate[day.date] ?? 0);

  return {
    averageHours: Number((totalHours / Math.max(dotation, 1)).toFixed(2)),
    minFreeSundays: freeSundays.length > 0 ? Math.min(...freeSundays) : 0,
    maxFreeSundays: freeSundays.length > 0 ? Math.max(...freeSundays) : 0,
    minCoverage: effectiveCoverageValues.length > 0 ? Math.min(...effectiveCoverageValues) : 0,
    coverageDeficitDays: effectiveDays
      .filter((day) => (effectiveCoverageByDate[day.date] ?? 0) < COVERAGE_MIN)
      .map((day) => `${day.date} (${effectiveCoverageByDate[day.date] ?? 0}/${COVERAGE_MIN})`),
    shiftCounts,
    coverageByDate,
    slotHours,
    weeklyHoursBySlot,
  };
}

function buildCpSatPayload(input: OptimizerLabInput) {
  const weekdays = [...WEEKDAY_LABELS];
  const horarioApe = Object.fromEntries(
    weekdays.map((day) => [day, { inicio: "10:00", fin: "19:00" }])
  );
  const horarioCie = Object.fromEntries(
    weekdays.map((day) => [day, { inicio: "11:00", fin: "20:00" }])
  );
  const horarioCom = Object.fromEntries(
    weekdays.map((day) => [day, { inicio: "10:00", fin: "20:00" }])
  );
  const franja = Object.fromEntries(
    weekdays.map((day) => [day, { apertura: "10:00", cierre: "20:00" }])
  );

  return {
    branch: {
      id: "branch_lab_vm7",
      codigo_area: "VM7-LAB",
      nombre: "Ventas Mall Dominical Lab",
      tipo_franja: "movicenter",
    },
    rotation_group: "V_M7",
    month: { year: input.year, month: input.month },
    workers: Array.from({ length: input.dotation }, (_, index) => ({
      rut: `slot-${index + 1}`,
      nombre: `Trabajador ${index + 1}`,
      constraints: [],
    })),
    holidays: [],
    shift_catalog: [
      {
        id: "V_M7_APE",
        nombre_display: "Apertura corta",
        rotation_group: "V_M7",
        nombre_turno: "apertura",
        horario_por_dia: horarioApe,
        descuenta_colacion: true,
        dias_aplicables: weekdays,
      },
      {
        id: "V_M7_CIE",
        nombre_display: "Cierre corto",
        rotation_group: "V_M7",
        nombre_turno: "cierre",
        horario_por_dia: horarioCie,
        descuenta_colacion: true,
        dias_aplicables: weekdays,
      },
      {
        id: "V_M7_COM",
        nombre_display: "Completo",
        rotation_group: "V_M7",
        nombre_turno: "completo",
        horario_por_dia: horarioCom,
        descuenta_colacion: true,
        dias_aplicables: weekdays,
      },
    ],
    franja_por_dia: franja,
    carryover_horas: {},
    parametros: {
      modo: "ilp",
      num_propuestas: input.numProposals,
      horas_semanales_max: input.weeklyHoursTarget,
      horas_semanales_min: input.weeklyHoursTarget,
      horas_semanales_obj: input.weeklyHoursTarget,
      dias_maximos_consecutivos: input.maxConsecutiveDays,
      domingos_libres_minimos: input.minFreeSundays,
      peak_desde: "17:00",
      cobertura_minima: COVERAGE_MIN,
      cobertura_optima_peak: COVERAGE_MIN,
      cobertura_optima_off_peak: COVERAGE_MIN,
      priorizar_fin_de_semana: true,
      time_limit_seconds: input.timeLimitSeconds,
      descanso_entre_jornadas: false,
      peso_cobertura_peak: 10,
      peso_finde: 5,
      peso_balance: 3,
      peso_ociosidad: 1,
    },
  };
}

function buildCpSatAssignments(
  rawAssignments: Array<{ worker_slot: number; date: string; shift_id: string }>,
  effectiveDays: LabDay[],
  dotation: number
) {
  const weekIndexByDate = new Map(
    effectiveDays.map((day, index) => [day.date, Math.floor(index / 7)])
  );
  const rawByKey = new Map(
    rawAssignments.map((assignment) => [`${assignment.worker_slot}-${assignment.date}`, assignment])
  );

  const assignments: LabAssignment[] = [];

  for (let slotNumber = 1; slotNumber <= dotation; slotNumber += 1) {
    effectiveDays.forEach((day) => {
      const raw = rawByKey.get(`${slotNumber}-${day.date}`);
      const shiftId = raw?.shift_id ?? "OFF";
      const shift = SHIFT_MAP[shiftId] ?? SHIFT_MAP.OFF;

      assignments.push({
        slotNumber,
        date: day.date,
        shiftId: shiftId as ShiftId,
        label: shift.label,
        laborHours: shift.laborHours,
        isOff: shiftId === "OFF",
        weekIndex: weekIndexByDate.get(day.date) ?? 0,
      });
    });
  }

  return assignments;
}

function adaptCpSatResponse(
  input: OptimizerLabInput,
  visibleDays: LabDay[],
  effectiveDays: LabDay[],
  backend: CpSatOptimizeResponse
): OptimizerLabResponse {
  const weekCount = Math.ceil(effectiveDays.length / 7);
  const proposals: OptimizerProposal[] = (backend.propuestas ?? []).map((proposal, index) => {
    const assignments = buildCpSatAssignments(proposal.asignaciones, effectiveDays, input.dotation);
    const metrics = buildMetrics(assignments, visibleDays, effectiveDays, weekCount, input.dotation);

    return {
      id: proposal.id || `cp-sat-${index + 1}`,
      score: proposal.score,
      assignments: assignments.filter((assignment) =>
        visibleDays.some((day) => day.date === assignment.date)
      ),
      metrics,
    };
  });

  return {
    input,
    visibleDays,
    effectiveDays,
    diagnostic: {
      categoryLabel: "Ventas Mall Dominical",
      solverMode: "cp_sat",
      dotationAvailable: backend.diagnostico?.dotacion_disponible ?? input.dotation,
      minimumSuggested: backend.diagnostico?.dotacion_minima_requerida ?? null,
      feasible: proposals.length > 0,
      messages:
        backend.diagnostico?.mensajes?.length
          ? backend.diagnostico.mensajes
          : [backend.detail ?? "No se obtuvo respuesta diagnostica del solver exacto."],
      effectiveStart: effectiveDays[0]?.date ?? "",
      effectiveEnd: effectiveDays[effectiveDays.length - 1]?.date ?? "",
    },
    proposals,
  };
}

async function runCpSatLab(input: OptimizerLabInput): Promise<OptimizerLabResponse> {
  const { visibleDays, effectiveDays } = getMonthDates(input.year, input.month);
  const baseUrl =
    process.env.V3_CP_SAT_OPTIMIZER_BASE_URL ??
    process.env.V2_OPTIMIZER_BASE_URL ??
    "http://127.0.0.1:8022/api";

  try {
    const response = await fetch(`${baseUrl}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(buildCpSatPayload(input)),
    });

    const body = (await response.json().catch(() => null)) as CpSatOptimizeResponse | null;

    if (!response.ok || !body) {
      return {
        input,
        visibleDays,
        effectiveDays,
        diagnostic: {
          categoryLabel: "Ventas Mall Dominical",
          solverMode: "cp_sat",
          dotationAvailable: input.dotation,
          minimumSuggested: body?.diagnostico?.dotacion_minima_requerida ?? null,
          feasible: false,
          messages: [
            body?.detail ??
              "No fue posible ejecutar OR-Tools CP-SAT desde esta interfaz. Revisa la disponibilidad del optimizer backend.",
          ],
          effectiveStart: effectiveDays[0]?.date ?? "",
          effectiveEnd: effectiveDays[effectiveDays.length - 1]?.date ?? "",
        },
        proposals: [],
      };
    }

    return adaptCpSatResponse(input, visibleDays, effectiveDays, body);
  } catch (error) {
    return {
      input,
      visibleDays,
      effectiveDays,
      diagnostic: {
        categoryLabel: "Ventas Mall Dominical",
        solverMode: "cp_sat",
        dotationAvailable: input.dotation,
        minimumSuggested: null,
        feasible: false,
        messages: [
          error instanceof Error
            ? `No fue posible conectar con el solver OR-Tools: ${error.message}`
            : "No fue posible conectar con el solver OR-Tools.",
        ],
        effectiveStart: effectiveDays[0]?.date ?? "",
        effectiveEnd: effectiveDays[effectiveDays.length - 1]?.date ?? "",
      },
      proposals: [],
    };
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Payload invalido para optimizer lab.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const result =
    parsed.data.solverMode === "cp_sat"
      ? await runCpSatLab(parsed.data)
      : runOptimizerLab(parsed.data);

  return NextResponse.json(result);
}
