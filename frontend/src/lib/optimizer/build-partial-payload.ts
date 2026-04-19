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
export function buildPartialPayload(
  basePayload: OptimizePayload,
  currentAssignments: CalendarAssignment[],
  params: PartialRecalculateParams
): PartialOptimizePayload {
  const { desde, hasta, excludedRuts, modo } = params;

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
