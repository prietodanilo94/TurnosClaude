import type { ShiftDef } from "@/types/optimizer";

const WEEKDAY_KEYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function weekdayKey(dateStr: string): string {
  return WEEKDAY_KEYS[new Date(`${dateStr}T12:00:00`).getDay()];
}

export function getShiftWindow(
  shift: ShiftDef | null | undefined,
  dateStr: string
): { inicio: string; fin: string } | null {
  if (!shift) return null;
  const key = weekdayKey(dateStr);
  const exact = shift.horario_por_dia[key];
  if (exact) return exact;
  const first = Object.values(shift.horario_por_dia)[0];
  return first ?? null;
}

export function getShiftDurationMinutes(
  shift: ShiftDef | undefined,
  dateStr: string
): number {
  const window = getShiftWindow(shift, dateStr);
  if (!window) return 0;
  const raw = parseTime(window.fin) - parseTime(window.inicio);
  if (!shift?.descuenta_colacion) return raw;
  return raw >= 8 * 60 ? raw - 60 : raw;
}

export function getShiftLabel(
  shift: ShiftDef | undefined,
  dateStr: string
): string {
  const window = getShiftWindow(shift, dateStr);
  return window ? `${window.inicio}-${window.fin}` : "";
}
