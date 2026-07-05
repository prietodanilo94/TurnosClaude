// F11 — logica pura del editor de horario libre. El estado del editor es
// workerId -> dateStr -> DayShift (la ausencia de una fecha = dia libre).
// Sin React ni Prisma: el componente FreeScheduleEditor consume estas
// funciones y las paginas server arman los datos.
//
// Al guardar, el estado se materializa al modelo Calendar existente
// (slots + assignments, slot i+1 = worker i en orden dado) para heredar
// export RRHH, F10 y validacion sin cambios.
import type { CalendarSlot, DayShift } from "@/types";
import { shiftDuration } from "./calendar-utils";

export type FreeScheduleState = Record<string, Record<string, DayShift>>;

export interface FreeWorkerInput {
  id: string;
  nombre: string;
}

// ─── construccion / materializacion ─────────────────────────────────────────

// Estado desde un calendario guardado (slots+assignments parseados). Se usa
// como baseline del diff al guardar y como estado inicial si origen=libre.
export function stateFromCalendar(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
): FreeScheduleState {
  const state: FreeScheduleState = {};
  for (const slot of slots) {
    const workerId = assignments[String(slot.slotNumber)] ?? null;
    if (!workerId) continue;
    for (const [dateStr, shift] of Object.entries(slot.days)) {
      if (!shift) continue;
      if (!state[workerId]) state[workerId] = {};
      state[workerId][dateStr] = shift;
    }
  }
  return state;
}

export function mergeStates(states: FreeScheduleState[]): FreeScheduleState {
  return Object.assign({}, ...states);
}

// Materializa el estado de UN equipo al formato Calendar: slot i+1 = worker
// i (orden de la lista recibida — nombre asc, mismo criterio del generador).
// La grilla cubre todas las fechas visibles del mes (semanas Lun-Dom
// completas), con null explicito en dias libres, igual que los rotativos.
export function materializeTeam(
  state: FreeScheduleState,
  workers: FreeWorkerInput[],
  gridDates: string[],
): { slots: CalendarSlot[]; assignments: Record<string, string | null> } {
  const slots: CalendarSlot[] = [];
  const assignments: Record<string, string | null> = {};
  workers.forEach((worker, i) => {
    const days: Record<string, DayShift | null> = {};
    for (const dateStr of gridDates) {
      days[dateStr] = state[worker.id]?.[dateStr] ?? null;
    }
    slots.push({ slotNumber: i + 1, days });
    assignments[String(i + 1)] = worker.id;
  });
  return { slots, assignments };
}

// ─── edicion ─────────────────────────────────────────────────────────────────

export function applyToCells(
  state: FreeScheduleState,
  cells: { workerId: string; dateStr: string }[],
  shift: DayShift | null,
): FreeScheduleState {
  const next: FreeScheduleState = { ...state };
  for (const { workerId, dateStr } of cells) {
    const row = { ...(next[workerId] ?? {}) };
    if (shift) row[dateStr] = shift;
    else delete row[dateStr];
    next[workerId] = row;
  }
  return next;
}

export function setCell(
  state: FreeScheduleState,
  workerId: string,
  dateStr: string,
  shift: DayShift | null,
): FreeScheduleState {
  return applyToCells(state, [{ workerId, dateStr }], shift);
}

// Copia la fila completa de un trabajador a otro (solo las fechas dadas).
export function copyRow(
  state: FreeScheduleState,
  fromWorkerId: string,
  toWorkerId: string,
  dates: string[],
): FreeScheduleState {
  const next: FreeScheduleState = { ...state };
  const row = { ...(next[toWorkerId] ?? {}) };
  for (const dateStr of dates) {
    const shift = state[fromWorkerId]?.[dateStr];
    if (shift) row[dateStr] = shift;
    else delete row[dateStr];
  }
  next[toWorkerId] = row;
  return next;
}

// Copia una semana (7 fechas origen) a otra (7 fechas destino, por indice de
// dia) para los trabajadores dados.
export function copyWeek(
  state: FreeScheduleState,
  workerIds: string[],
  fromDates: string[],
  toDates: string[],
): FreeScheduleState {
  let next = state;
  const cellsToSet: { workerId: string; dateStr: string; shift: DayShift | null }[] = [];
  for (const workerId of workerIds) {
    for (let i = 0; i < toDates.length && i < fromDates.length; i++) {
      cellsToSet.push({ workerId, dateStr: toDates[i], shift: state[workerId]?.[fromDates[i]] ?? null });
    }
  }
  for (const { workerId, dateStr, shift } of cellsToSet) {
    next = setCell(next, workerId, dateStr, shift);
  }
  return next;
}

// Fechas del mes que caen en el dia de semana dado (0=Lun .. 6=Dom).
export function weekdayDatesOfMonth(year: number, month: number, dow: number): string[] {
  const result: string[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    if ((date.getDay() + 6) % 7 === dow) {
      result.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return result;
}

// ─── metricas por fila (feedback en vivo) ────────────────────────────────────

// Horas trabajadas de una semana (7 fechas). Las fechas anteriores al mes se
// resuelven contra la cola real del mes anterior si se entrega.
export function rowWeekHours(
  state: FreeScheduleState,
  workerId: string,
  weekDates: string[],
  monthStartStr: string,
  prevTail?: Record<string, DayShift | null>,
): number {
  let total = 0;
  for (const dateStr of weekDates) {
    const shift = dateStr < monthStartStr
      ? prevTail?.[dateStr] ?? null
      : state[workerId]?.[dateStr] ?? null;
    if (shift) total += shiftDuration(shift);
  }
  return Math.round(total * 10) / 10;
}

// Racha maxima de dias consecutivos trabajados, incluyendo la cola real del
// mes anterior. Si hay cola, las fechas del estado anteriores al mes se
// ignoran (la cola es la fuente de verdad ahi — misma semantica de
// reemplazo que effectiveDays en validation.ts).
export function rowMaxRun(
  state: FreeScheduleState,
  workerId: string,
  monthStartStr: string,
  prevTail?: Record<string, DayShift | null>,
): number {
  const worked = new Set<string>();
  for (const [dateStr, shift] of Object.entries(prevTail ?? {})) {
    if (shift) worked.add(dateStr);
  }
  for (const dateStr of Object.keys(state[workerId] ?? {})) {
    if (prevTail && dateStr < monthStartStr) continue;
    worked.add(dateStr);
  }
  const dates = [...worked].sort();
  let maxRun = 0, run = 0;
  let prev: string | null = null;
  for (const dateStr of dates) {
    if (prev) {
      const diff = Math.round(
        (new Date(dateStr + "T12:00:00").getTime() - new Date(prev + "T12:00:00").getTime()) / 86400000,
      );
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    maxRun = Math.max(maxRun, run);
    prev = dateStr;
  }
  return maxRun;
}

export function rowFreeSundays(
  state: FreeScheduleState,
  workerId: string,
  sundays: string[],
): number {
  return sundays.filter((s) => !state[workerId]?.[s]).length;
}

// ─── diff para save-notify / F10 ─────────────────────────────────────────────

export interface FreeChangeItem {
  workerId: string;
  workerName: string;
  date: string;
  dayLabel: string;
  from: string | null;
  to: string | null;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Cambios entre el estado guardado y el nuevo, solo fechas del mes editado.
// Mismo formato ChangeItem que computeCalendarDiff para que save-notify,
// el webhook y F10 funcionen sin cambios.
export function diffStates(
  oldState: FreeScheduleState,
  newState: FreeScheduleState,
  workerNames: Record<string, string>,
  year: number,
  month: number,
): FreeChangeItem[] {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const changes: FreeChangeItem[] = [];
  const workerIds = new Set([...Object.keys(oldState), ...Object.keys(newState)]);

  for (const workerId of workerIds) {
    const dates = new Set([
      ...Object.keys(oldState[workerId] ?? {}),
      ...Object.keys(newState[workerId] ?? {}),
    ]);
    for (const dateStr of [...dates].sort()) {
      if (!dateStr.startsWith(monthPrefix)) continue;
      const oldShift = oldState[workerId]?.[dateStr] ?? null;
      const newShift = newState[workerId]?.[dateStr] ?? null;
      const from = oldShift ? `${oldShift.start}-${oldShift.end}` : null;
      const to = newShift ? `${newShift.start}-${newShift.end}` : null;
      if (from === to) continue;
      const dt = new Date(dateStr + "T12:00:00");
      changes.push({
        workerId,
        workerName: workerNames[workerId] ?? workerId,
        date: dateStr,
        dayLabel: `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTH_SHORT[month]}`,
        from,
        to,
      });
    }
  }
  return changes;
}
