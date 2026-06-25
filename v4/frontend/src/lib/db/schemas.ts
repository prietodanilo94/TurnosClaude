import { z } from "zod";

// ── Primitivos ───────────────────────────────────────────────────────────────

export const DayShiftSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end:   z.string().regex(/^\d{2}:\d{2}$/),
});

// 7 entradas: [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]. null = día libre.
export const WeekPatternSchema = z.array(z.union([DayShiftSchema, z.null()])).length(7);

// ── Columnas JSON de ShiftPattern ────────────────────────────────────────────

// rotationJson: array de semanas (1, 2 o 4)
export const RotationJsonSchema = z.array(WeekPatternSchema).min(1).max(4);

// weeklyHoursJson: [horas_sem1, horas_sem2, ...]
export const WeeklyHoursJsonSchema = z.array(z.number().nonnegative());

// ── Columnas JSON de Calendar ────────────────────────────────────────────────

// Un slot: slotNumber → Record<date_YYYY-MM-DD, DayShift | null>
export const CalendarSlotSchema = z.object({
  slotNumber:  z.number().int().positive(),
  days:        z.record(z.string(), z.union([DayShiftSchema, z.null()])),
  semanaOffset: z.number().int().nonnegative().optional(),
});

export const SlotsDataSchema = z.array(CalendarSlotSchema);

// assignments: { "1": workerId | null, "2": workerId | null, ... }
export const AssignmentsSchema = z.record(z.string(), z.union([z.string(), z.null()]));

// ── Parsers seguros ──────────────────────────────────────────────────────────
// Lanzan error descriptivo en lugar de producir tipos incorrectos silenciosamente.

function safeParse<T>(schema: z.ZodType<T>, raw: string, context: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[db/schemas] JSON.parse falló en ${context}: ${raw.slice(0, 80)}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `[db/schemas] Validación falló en ${context}: ${result.error.message.slice(0, 200)}`,
    );
  }
  return result.data;
}

export function parseSlotsData(raw: string): z.infer<typeof SlotsDataSchema> {
  return safeParse(SlotsDataSchema, raw, "Calendar.slotsData");
}

export function parseAssignments(raw: string): z.infer<typeof AssignmentsSchema> {
  return safeParse(AssignmentsSchema, raw, "Calendar.assignments");
}

export function parseRotationJson(raw: string): z.infer<typeof RotationJsonSchema> {
  return safeParse(RotationJsonSchema, raw, "ShiftPattern.rotationJson");
}

export function parseWeeklyHoursJson(raw: string): z.infer<typeof WeeklyHoursJsonSchema> {
  return safeParse(WeeklyHoursJsonSchema, raw, "ShiftPattern.weeklyHoursJson");
}

// ── Schemas de request body para API routes ──────────────────────────────────

/** POST /api/admin/patterns, PUT /api/admin/patterns/[id] */
export const ShiftPatternBodySchema = z.object({
  label:         z.string().min(1).max(120),
  areaNegocio:   z.string().min(1).max(80),
  rotationWeeks: RotationJsonSchema,
  weeklyHours:   WeeklyHoursJsonSchema,
});

/** POST /api/calendars/save-notify */
export const SaveNotifyBodySchema = z.object({
  teamIds:    z.array(z.string().min(1)).min(1),
  year:       z.number().int().min(2024).max(2035),
  month:      z.number().int().min(1).max(12),
  scopeLabel: z.string().optional(),
  scopeType:  z.enum(["branch", "group"]).optional(),
  changes:    z.unknown().optional(),
});

/** PATCH /api/teams/[id]/categoria */
export const TeamCategoriaBodySchema = z.object({
  categoria: z.string().min(1),
});

const ValidationSummarySchema = z.object({
  errorCount:    z.number().int().nonnegative(),
  warningCount:  z.number().int().nonnegative(),
  warningCodes:  z.array(z.string()),
}).optional();

/**
 * Body de POST /api/calendars y PUT /api/calendars.
 * Valida que los datos del calendario vengan bien formados antes de persistir.
 */
export const CalendarSaveBodySchema = z.object({
  // POST
  teamId:   z.string().min(1).optional(),
  year:     z.number().int().min(2024).max(2035),
  month:    z.number().int().min(1).max(12),
  // PUT
  id:       z.string().min(1).optional(),
  slotsData:   SlotsDataSchema,
  assignments: AssignmentsSchema,
  validationSummary: ValidationSummarySchema,
  scopeLabel: z.string().optional(),
  scopeType:  z.enum(["branch", "group"]).optional(),
});
