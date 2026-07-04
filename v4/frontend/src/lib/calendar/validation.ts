import type { CalendarSlot, DayShift } from "@/types";
import type { WorkerBlockDateMap } from "@/lib/calendar/generator";
import { shiftDuration, FERIADOS_IRRENUNCIABLES } from "./calendar-utils";

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
    | "day_without_coverage"
    | "consecutive_days_exceeded"
    | "sundays_off_insufficient"
    | "sundays_off_consecutive";
  title: string;
  detail: string;
  dateStr?: string;
  slotNumber?: number;
  workerId?: string;
}

// workerId -> dateStr -> turno real guardado (null explicito = dia libre
// segun lo publicado el mes anterior; distinto de "sin informacion").
export type PrevMonthShiftsMap = Record<string, Record<string, DayShift | null>>;

interface ValidateCalendarInput {
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workerMap: Record<string, string>;
  blockMap?: WorkerBlockDateMap;
  // Cola REAL del mes anterior (ver extractPrevMonthTail). Si se entrega,
  // los dias previos al mes se validan contra lo realmente guardado en vez
  // de contra la grilla extendida (que asume el patron y puede no coincidir
  // con calendarios editados a mano). F11 Fase 0.
  prevMonthShifts?: PrevMonthShiftsMap;
  // Fecha de hoy (YYYY-MM-DD). Si se entrega, una semana >42h que ya
  // termino por completo en el pasado sigue reportandose como error pero
  // NO activa el bloqueo duro de guardado (exceeds42hLimit): ya no es
  // corregible y bloquearia el calendario para siempre.
  todayStr?: string;
}

export interface CalendarValidationResult {
  issues: CalendarValidationIssue[];
  errors: CalendarValidationIssue[];
  warnings: CalendarValidationIssue[];
  canSave: boolean;
  exceeds42hLimit: boolean;
}

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

// Dias efectivos de un slot para validar: los dias del mes actual (y
// posteriores) vienen de la grilla del calendario; los dias ANTERIORES al
// mes se reemplazan por la cola real del mes anterior cuando se conoce al
// trabajador. Sin trabajador asignado o sin cola, se usa la grilla tal cual
// (comportamiento historico).
function effectiveDays(
  slot: CalendarSlot,
  workerId: string | null,
  monthStartStr: string,
  prevMonthShifts?: PrevMonthShiftsMap,
): Record<string, DayShift | null> {
  const tail = workerId ? prevMonthShifts?.[workerId] : undefined;
  if (!tail) return slot.days as Record<string, DayShift | null>;
  const merged: Record<string, DayShift | null> = {};
  for (const [dateStr, shift] of Object.entries(slot.days)) {
    if (dateStr >= monthStartStr) merged[dateStr] = shift as DayShift | null;
  }
  for (const [dateStr, shift] of Object.entries(tail)) {
    if (dateStr < monthStartStr) merged[dateStr] = shift;
  }
  return merged;
}

// Domingo (fin de semana ISO) de la semana a la que pertenece la fecha.
function isoWeekSunday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dayNr = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNr + 6);
  return fmt(d);
}

function maxConsecutiveWorkRun(days: Record<string, DayShift | null>): number {
  const sortedDates = Object.keys(days).sort();
  let maxRun = 0;
  let curRun = 0;
  let prevDate: string | null = null;
  for (const dateStr of sortedDates) {
    const shift = days[dateStr];
    if (shift !== null && shift !== undefined) {
      if (prevDate !== null) {
        const diff = Math.round(
          (new Date(dateStr + "T12:00:00").getTime() - new Date(prevDate + "T12:00:00").getTime()) / 86400000,
        );
        curRun = diff === 1 ? curRun + 1 : 1;
      } else {
        curRun = 1;
      }
      maxRun = Math.max(maxRun, curRun);
    } else {
      curRun = 0;
    }
    prevDate = dateStr;
  }
  return maxRun;
}

function getSundaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 0) result.push(fmt(date));
  }
  return result;
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
  prevMonthShifts,
  todayStr,
}: ValidateCalendarInput): CalendarValidationResult {
  const issues: CalendarValidationIssue[] = [];
  const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`;

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
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    // Sin filtro de mes a propósito: se usa la grilla extendida (semanas
    // lunes-domingo completas) para que la semana que cruza fin de mes sume
    // sus 7 días. Los días previos al mes se reemplazan por la cola REAL
    // del mes anterior si está disponible (effectiveDays) — la grilla
    // asume el patrón y puede no coincidir con lo realmente publicado.
    const days = effectiveDays(slot, workerId, monthStartStr, prevMonthShifts);
    const weekHours: Record<string, number> = {};
    const weekSunday: Record<string, string> = {};
    for (const [dateStr, shift] of Object.entries(days)) {
      if (!shift) continue;
      if (isFeriado(dateStr)) continue;
      const wk = isoWeekKey(dateStr);
      weekHours[wk] = (weekHours[wk] ?? 0) + shiftDuration(shift);
      if (!weekSunday[wk]) weekSunday[wk] = isoWeekSunday(dateStr);
    }
    for (const [wk, hours] of Object.entries(weekHours)) {
      if (hours > 42) {
        // Una semana que ya terminó no es corregible: se reporta como error
        // (visibilidad) pero no activa el bloqueo duro, o el calendario
        // quedaría inguardable el resto del mes.
        const fixable = !todayStr || weekSunday[wk] >= todayStr;
        if (fixable) exceeds42hLimit = true;
        issues.push({
          severity: "error",
          code: "weekly_hours_high",
          title: `Slot ${slot.slotNumber} supera 42h en semana ${wk}`,
          detail: `Tiene ${Number.isInteger(hours) ? hours : hours.toFixed(1)}h planificadas. Máximo permitido: 42h semanales.${fixable ? "" : " (Semana ya transcurrida — no bloquea el guardado.)"}`,
          slotNumber: slot.slotNumber,
        });
      }
    }
  }

  // Consecutive days check + Sunday rest check
  const sundaysInMonth = getSundaysInMonth(year, month);
  for (const slot of slots) {
    if (!hasShiftInMonth(slot, year, month)) continue;

    const workerId = assignments[String(slot.slotNumber)] ?? null;
    const days = effectiveDays(slot, workerId, monthStartStr, prevMonthShifts);

    const maxRun = maxConsecutiveWorkRun(days);
    if (maxRun > 6) {
      issues.push({
        severity: "error",
        code: "consecutive_days_exceeded",
        title: `Slot ${slot.slotNumber}: ${maxRun} días laborales consecutivos`,
        detail: `El máximo permitido es 6 días consecutivos de trabajo. Añade un día libre para romper la racha.`,
        slotNumber: slot.slotNumber,
      });
    }

    const offSundays = sundaysInMonth.filter((s) => !days[s]);
    const worksAnySunday = sundaysInMonth.some((s) => !!days[s]);

    if (offSundays.length < 2) {
      issues.push({
        severity: "error",
        code: "sundays_off_insufficient",
        title: `Slot ${slot.slotNumber}: solo ${offSundays.length} domingo${offSundays.length !== 1 ? "s" : ""} libre`,
        detail: `Se requieren al menos 2 domingos libres en el mes. Libera ${2 - offSundays.length} domingo${2 - offSundays.length !== 1 ? "s" : ""} más.`,
        slotNumber: slot.slotNumber,
      });
    } else if (worksAnySunday) {
      // Solo verificar consecutivos si el trabajador trabaja algún domingo
      for (let i = 0; i < offSundays.length - 1; i++) {
        const gap = Math.round(
          (new Date(offSundays[i + 1] + "T12:00:00").getTime() - new Date(offSundays[i] + "T12:00:00").getTime()) / 86400000,
        );
        if (gap === 7) {
          issues.push({
            severity: "error",
            code: "sundays_off_consecutive",
            title: `Slot ${slot.slotNumber}: domingos libres en semanas seguidas`,
            detail: `Los domingos ${dateLabel(offSundays[i])} y ${dateLabel(offSundays[i + 1])} son consecutivos. Al menos un domingo entre ellos debe ser trabajado.`,
            slotNumber: slot.slotNumber,
            dateStr: offSundays[i],
          });
          break;
        }
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

