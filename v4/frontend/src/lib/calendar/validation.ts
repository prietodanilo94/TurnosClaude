import type { CalendarSlot, DayShift } from "@/types";
import type { WorkerBlockDateMap } from "@/lib/calendar/generator";

export type CalendarValidationSeverity = "error" | "warning";

export interface CalendarValidationIssue {
  severity: CalendarValidationSeverity;
  code:
    | "empty_calendar"
    | "unassigned_slot"
    | "unknown_worker"
    | "duplicate_worker"
    | "blocked_worker"
    | "weekly_hours_high"
    | "day_without_coverage";
  title: string;
  detail: string;
  dateStr?: string;
  slotNumber?: number;
  workerId?: string;
}

interface ValidateCalendarInput {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap?: WorkerBlockDateMap;
}

export interface CalendarValidationResult {
  issues: CalendarValidationIssue[];
  errors: CalendarValidationIssue[];
  warnings: CalendarValidationIssue[];
  canSave: boolean;
  exceeds42hLimit: boolean;
}

function shiftDuration(shift: DayShift): number {
  const [h1, m1] = shift.start.split(":").map(Number);
  const [h2, m2] = shift.end.split(":").map(Number);
  const total = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
  return total >= 6 ? total - 1 : total;
}

const FERIADOS_IRRENUNCIABLES: [number, number][] = [
  [1, 1], [5, 1], [9, 18], [9, 19], [12, 25],
];
function isFeriado(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return FERIADOS_IRRENUNCIABLES.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const year = target.getUTCFullYear();
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function hasShiftInMonth(slot: CalendarSlot, year: number, month: number): boolean {
  return Object.entries(slot.days).some(([dateStr, shift]) => {
    if (!shift) return false;
    const d = new Date(dateStr + "T12:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function validateCalendarForPublish({
  year,
  month,
  slots,
  assignments,
  workerMap,
  blockMap = {},
}: ValidateCalendarInput): CalendarValidationResult {
  const issues: CalendarValidationIssue[] = [];

  if (slots.length === 0) {
    issues.push({
      severity: "error",
      code: "empty_calendar",
      title: "Calendario sin turnos",
      detail: "Genera el calendario antes de guardarlo.",
    });
  }

  const assignedWorkers = new Map<string, number[]>();

  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    const slotHasShift = hasShiftInMonth(slot, year, month);

    if (slotHasShift && !workerId) {
      issues.push({
        severity: "error",
        code: "unassigned_slot",
        title: `Vendedor ${slot.slotNumber} sin asignar`,
        detail: "Este slot tiene turnos en el mes, pero no tiene vendedor asignado.",
        slotNumber: slot.slotNumber,
      });
      continue;
    }

    if (!workerId) continue;

    if (!workerMap[workerId]) {
      issues.push({
        severity: "error",
        code: "unknown_worker",
        title: `Vendedor desconocido en slot ${slot.slotNumber}`,
        detail: "La asignacion apunta a un vendedor que no aparece en el equipo activo.",
        slotNumber: slot.slotNumber,
        workerId,
      });
    }

    const slotsForWorker = assignedWorkers.get(workerId) ?? [];
    slotsForWorker.push(slot.slotNumber);
    assignedWorkers.set(workerId, slotsForWorker);

    for (const [dateStr, shift] of Object.entries(slot.days)) {
      if (!shift) continue;
      const d = new Date(dateStr + "T12:00:00");
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;

      if (blockMap[workerId]?.[dateStr] !== undefined) {
        const reason = blockMap[workerId][dateStr];
        issues.push({
          severity: "error",
          code: "blocked_worker",
          title: `${workerMap[workerId] ?? "Vendedor"} bloqueado el ${dateLabel(dateStr)}`,
          detail: reason
            ? `Tiene bloqueo registrado: ${reason}. Cambia el vendedor o deja ese dia libre.`
            : "Tiene bloqueo registrado. Cambia el vendedor o deja ese dia libre.",
          dateStr,
          slotNumber: slot.slotNumber,
          workerId,
        });
      }
    }
  }

  for (const [workerId, slotNumbers] of assignedWorkers.entries()) {
    if (slotNumbers.length <= 1) continue;
    issues.push({
      severity: "error",
      code: "duplicate_worker",
      title: `${workerMap[workerId] ?? "Vendedor"} asignado mas de una vez`,
      detail: `Aparece en los slots ${slotNumbers.join(", ")}. Cada vendedor debe quedar en un solo slot.`,
      workerId,
    });
  }

  let exceeds42hLimit = false;
  for (const slot of slots) {
    const weekHours: Record<string, number> = {};
    for (const [dateStr, shift] of Object.entries(slot.days)) {
      if (!shift) continue;
      const d = new Date(dateStr + "T12:00:00");
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
      if (isFeriado(dateStr)) continue;
      const wk = isoWeekKey(dateStr);
      weekHours[wk] = (weekHours[wk] ?? 0) + shiftDuration(shift);
    }
    for (const [wk, hours] of Object.entries(weekHours)) {
      if (hours > 42) {
        exceeds42hLimit = true;
        issues.push({
          severity: "error",
          code: "weekly_hours_high",
          title: `Slot ${slot.slotNumber} supera 42h en semana ${wk}`,
          detail: `Tiene ${Number.isInteger(hours) ? hours : hours.toFixed(1)}h planificadas. Máximo permitido: 42h semanales.`,
          slotNumber: slot.slotNumber,
        });
      }
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = fmt(new Date(year, month - 1, day));
    const hasCoverage = slots.some((slot) => {
      const workerId = assignments[String(slot.slotNumber)] ?? null;
      return workerId && slot.days[dateStr];
    });
    const hasTemplateShift = slots.some((slot) => slot.days[dateStr]);

    if (hasTemplateShift && !hasCoverage) {
      issues.push({
        severity: "warning",
        code: "day_without_coverage",
        title: `Sin cobertura asignada el ${dateLabel(dateStr)}`,
        detail: "Hay turnos en la plantilla, pero ningun turno tiene vendedor asignado para ese dia.",
        dateStr,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    issues,
    errors,
    warnings,
    canSave: errors.length === 0,
    exceeds42hLimit,
  };
}

