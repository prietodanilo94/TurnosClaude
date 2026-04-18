import { z } from "zod";
import type { WorkerConstraint } from "@/types/models";

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;

export const diaProhibidoSchema = z.object({
  tipo: z.literal("dia_prohibido"),
  valor: z.enum(DIAS, { required_error: "Seleccioná un día" }),
  notas: z.string().optional(),
});

export const turnoProhibidoSchema = z.object({
  tipo: z.literal("turno_prohibido"),
  valor: z.string().min(1, "Seleccioná un turno"),
  notas: z.string().optional(),
});

export const vacacionesSchema = z.object({
  tipo: z.literal("vacaciones"),
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  notas: z.string().optional(),
}).refine(
  (d) => d.fecha_desde <= d.fecha_hasta,
  { message: "La fecha de inicio debe ser anterior o igual a la de fin", path: ["fecha_hasta"] }
);

// dia_obligatorio_libre se almacena como vacaciones con desde === hasta
export const diaObligatorioLibreSchema = z.object({
  tipo: z.literal("dia_obligatorio_libre"),
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  notas: z.string().optional(),
});

export const exceptionSchema = z.discriminatedUnion("tipo", [
  diaProhibidoSchema,
  turnoProhibidoSchema,
  vacacionesSchema,
  diaObligatorioLibreSchema,
]);

export type ExceptionFormData = z.infer<typeof exceptionSchema>;

// ─── Validaciones de duplicados / solapamiento ────────────────────────────────

export function hasDuplicateDia(
  existing: WorkerConstraint[],
  valor: string,
  excludeId?: string
): boolean {
  return existing.some(
    (e) => e.tipo === "dia_prohibido" && e.valor === valor && e.$id !== excludeId
  );
}

export function hasDuplicateTurno(
  existing: WorkerConstraint[],
  valor: string,
  excludeId?: string
): boolean {
  return existing.some(
    (e) => e.tipo === "turno_prohibido" && e.valor === valor && e.$id !== excludeId
  );
}

export function hasVacacionesOverlap(
  existing: WorkerConstraint[],
  desde: string,
  hasta: string,
  excludeId?: string
): boolean {
  return existing.some((e) => {
    if (e.tipo !== "vacaciones" || e.$id === excludeId) return false;
    if (!e.fecha_desde || !e.fecha_hasta) return false;
    return desde <= e.fecha_hasta && hasta >= e.fecha_desde;
  });
}
