import { account } from "@/lib/auth/appwrite-client";
import { buildOptimizePayload, type OptimizePayload } from "./build-payload";
import type { PartialRecalculateParams } from "@/features/calendar/PartialRecalculateDialog";
import type { CalendarAssignment, OptimizerResponse } from "@/types/optimizer";

const OPTIMIZER_URL = process.env.NEXT_PUBLIC_OPTIMIZER_URL ?? "http://localhost:8000";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AssignmentFija {
  worker_rut: string;
  date: string;      // "YYYY-MM-DD"
  shift_id: string;
}

export interface PartialOptimizePayload extends OptimizePayload {
  partial_range: { desde: string; hasta: string };
  assignments_fijas: AssignmentFija[];
  workers_excluidos: string[];
}

// ─── Función pura (testeable sin Appwrite) ────────────────────────────────────

/**
 * Construye el payload para POST /optimize/partial a partir del payload base,
 * las asignaciones actuales del calendario y los parámetros del dialog.
 *
 * assignments_fijas = asignaciones fuera del rango (el solver las respeta como constantes).
 * workers del payload = todos menos los excluidos.
 */

// ─── ISO week boundary helpers ─────────────────────────────────────────────────

function isoWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function isoWeekSunday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + (7 - dow));
  return d.toISOString().slice(0, 10);
}

/**
 * Extiende desde/hasta para incluir días adyacentes del mes anterior/siguiente
 * que pertenecen a la misma semana ISO (regla: semana pertenece al mes con más días en ella).
 * Ej: si la semana de abril tiene lun-mar en marzo y mié-dom en abril → incluye lun-mar.
 */
export function extendToFullIsoWeeks(
  desde: string,
  hasta: string,
  existingDates?: Set<string>
): { desde: string; hasta: string } {
  const monday = isoWeekMonday(desde);
  const sunday = isoWeekSunday(hasta);

  let newDesde = desde;
  let newHasta = hasta;

  if (monday < desde) {
    const daysFromPrevMonth = Math.round(
      (new Date(desde + "T12:00:00Z").getTime() - new Date(monday + "T12:00:00Z").getTime()) / 86_400_000
    );
    // Solo extender si hay datos del mes anterior (evita incluir días sin asignaciones)
    const hasData = !existingDates || hasDateInRange(existingDates, monday, desde);
    if (daysFromPrevMonth < 4 && hasData) newDesde = monday;
  }

  if (sunday > hasta) {
    const daysFromNextMonth = Math.round(
      (new Date(sunday + "T12:00:00Z").getTime() - new Date(hasta + "T12:00:00Z").getTime()) / 86_400_000
    );
    // Solo extender si hay datos del mes siguiente
    const hasData = !existingDates || hasDateInRange(existingDates, hasta, sunday);
    if (daysFromNextMonth < 4 && hasData) newHasta = sunday;
  }

  return { desde: newDesde, hasta: newHasta };
}

function hasDateInRange(dates: Set<string>, from: string, to: string): boolean {
  return Array.from(dates).some((d) => d >= from && d <= to);
}

export function buildPartialPayload(
  basePayload: OptimizePayload,
  currentAssignments: CalendarAssignment[],
  params: PartialRecalculateParams
): PartialOptimizePayload {
  const { desde: rawDesde, hasta: rawHasta, excludedRuts, modo } = params;
  const existingDates = new Set(currentAssignments.map((a) => a.date));
  const { desde, hasta } = extendToFullIsoWeeks(rawDesde, rawHasta, existingDates);

  const assignments_fijas: AssignmentFija[] = currentAssignments
    .filter((a) => a.date < desde || a.date > hasta)
    .map(({ worker_rut, date, shift_id }) => ({ worker_rut, date, shift_id }));

  const workers = basePayload.workers.filter((w) => !excludedRuts.includes(w.rut));

  return {
    ...basePayload,
    workers,
    parametros: {
      ...basePayload.parametros,
      modo,
      num_propuestas: 1,
    },
    partial_range: { desde, hasta },
    assignments_fijas,
    workers_excluidos: excludedRuts,
  };
}

// ─── Caller async (usa Appwrite + fetch) ──────────────────────────────────────

export class PartialOptimizeError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly diagnostico?: unknown
  ) {
    super(message);
    this.name = "PartialOptimizeError";
  }
}

export async function callPartialOptimize(
  branchId: string,
  year: number,
  month: number,
  currentAssignments: CalendarAssignment[],
  params: PartialRecalculateParams
): Promise<OptimizerResponse> {
  const [basePayload, { jwt }] = await Promise.all([
    buildOptimizePayload(branchId, year, month),
    account.createJWT(),
  ]);

  const payload = buildPartialPayload(basePayload, currentAssignments, params);

  const res = await fetch(`${OPTIMIZER_URL}/optimize/partial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(payload),
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PartialOptimizeError(`Error ${res.status}`, res.status);
  }

  if (!res.ok) {
    const detail = (body as { detail?: string })?.detail ?? `Error ${res.status}`;
    const diagnostico = (body as { diagnostico?: unknown })?.diagnostico;
    throw new PartialOptimizeError(detail, res.status, diagnostico);
  }

  return body as OptimizerResponse;
}
