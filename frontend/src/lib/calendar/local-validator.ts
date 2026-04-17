/**
 * Validador client-side que espeja las 8 reglas del backend (validators.py).
 * Se usa para feedback inmediato en el calendario; POST /validate es la fuente
 * de verdad antes de guardar.
 */
import type { CalendarAssignment, ShiftDef, Violation } from "@/types/optimizer";
import type { Worker, WorkerConstraint } from "@/types/models";
import { calculateHours, isoWeek } from "./hours-calculator";

// ─── tipos auxiliares ─────────────────────────────────────────────────────────

interface ValidateContext {
  assignments: CalendarAssignment[];
  workers: Worker[];
  constraints: WorkerConstraint[];
  shiftCatalog: ShiftDef[];
  holidays: string[];
  horasSemanalesMax: number;
  diasMaximosConsecutivos: number;
  domingoLibresMinimos: number;
  coberturaminima: number;
  franjaPorDia: Record<string, { apertura: string; cierre: string } | null>;
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function dayOfWeek(dateStr: string): string {
  const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return days[new Date(dateStr + "T12:00:00").getDay()];
}

// ─── regla 1: horas semanales ─────────────────────────────────────────────────

function checkHorasSemanales(ctx: ValidateContext): Violation[] {
  const violations: Violation[] = [];
  const shiftMin: Record<string, number> = {};
  for (const s of ctx.shiftCatalog) shiftMin[s.id] = s.duracion_minutos;

  const horasPorRutSemana: Record<string, Record<number, number>> = {};
  for (const a of ctx.assignments) {
    const wk = isoWeek(a.date);
    if (!horasPorRutSemana[a.worker_rut]) horasPorRutSemana[a.worker_rut] = {};
    horasPorRutSemana[a.worker_rut][wk] =
      (horasPorRutSemana[a.worker_rut][wk] ?? 0) + (shiftMin[a.shift_id] ?? 0) / 60;
  }
  for (const [rut, weeks] of Object.entries(horasPorRutSemana)) {
    for (const [wk, h] of Object.entries(weeks)) {
      if (h > ctx.horasSemanalesMax) {
        violations.push({
          tipo: "horas_semanales_excedidas",
          worker_rut: rut,
          detalle: `Semana ${wk}: ${h}h > ${ctx.horasSemanalesMax}h`,
        });
      }
    }
  }
  return violations;
}

// ─── regla 2: días semanales ──────────────────────────────────────────────────

function checkDiasSemanales(ctx: ValidateContext): Violation[] {
  const violations: Violation[] = [];
  const diasPorRutSemana: Record<string, Record<number, Set<string>>> = {};

  for (const a of ctx.assignments) {
    const wk = isoWeek(a.date);
    if (!diasPorRutSemana[a.worker_rut]) diasPorRutSemana[a.worker_rut] = {};
    if (!diasPorRutSemana[a.worker_rut][wk]) diasPorRutSemana[a.worker_rut][wk] = new Set();
    diasPorRutSemana[a.worker_rut][wk].add(a.date);
  }
  for (const [rut, weeks] of Object.entries(diasPorRutSemana)) {
    for (const [wk, dates] of Object.entries(weeks)) {
      if (dates.size > ctx.diasMaximosConsecutivos) {
        violations.push({
          tipo: "dias_semanales_excedidos",
          worker_rut: rut,
          detalle: `Semana ${wk}: ${dates.size} días > ${ctx.diasMaximosConsecutivos}`,
        });
      }
    }
  }
  return violations;
}

// ─── regla 3: domingos libres ─────────────────────────────────────────────────

function checkDomingosLibres(ctx: ValidateContext): Violation[] {
  const violations: Violation[] = [];
  const domingosDates = ctx.assignments
    .filter((a) => dayOfWeek(a.date) === "domingo")
    .map((a) => a.date);
  const allDomingos = [...new Set(domingosDates)].sort();
  const openDomingos = allDomingos.length;
  if (openDomingos === 0) return [];

  const required = Math.max(1, Math.min(ctx.domingoLibresMinimos, openDomingos - 1));
  const maxWorked = openDomingos - required;

  const workedByRut: Record<string, number> = {};
  for (const a of ctx.assignments) {
    if (dayOfWeek(a.date) === "domingo") {
      workedByRut[a.worker_rut] = (workedByRut[a.worker_rut] ?? 0) + 1;
    }
  }
  for (const [rut, worked] of Object.entries(workedByRut)) {
    if (worked > maxWorked) {
      violations.push({
        tipo: "domingos_libres_insuficientes",
        worker_rut: rut,
        detalle: `Trabaja ${worked} domingos; máximo permitido ${maxWorked}`,
      });
    }
  }
  return violations;
}

// ─── regla 4: cobertura ───────────────────────────────────────────────────────

function checkCobertura(ctx: ValidateContext): Violation[] {
  const violations: Violation[] = [];
  const shiftMap: Record<string, ShiftDef> = {};
  for (const s of ctx.shiftCatalog) shiftMap[s.id] = s;

  const assignsByDate: Record<string, CalendarAssignment[]> = {};
  for (const a of ctx.assignments) {
    if (!assignsByDate[a.date]) assignsByDate[a.date] = [];
    assignsByDate[a.date].push(a);
  }

  for (const [date, assigns] of Object.entries(assignsByDate)) {
    const dow = dayOfWeek(date);
    const franja = ctx.franjaPorDia[dow];
    if (!franja) continue;

    const apertura = parseTime(franja.apertura);
    const cierre = parseTime(franja.cierre);

    for (let t = apertura; t < cierre; t += 30) {
      const count = assigns.filter((a) => {
        const s = shiftMap[a.shift_id];
        if (!s) return false;
        return parseTime(s.inicio) <= t && t < parseTime(s.fin);
      }).length;

      if (count < ctx.coberturaminima) {
        violations.push({
          tipo: "cobertura_insuficiente",
          detalle: `${date} ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}: ${count} trabajadores (mínimo ${ctx.coberturaminima})`,
        });
        break;
      }
    }
  }
  return violations;
}

// ─── regla 5: feriados ────────────────────────────────────────────────────────

function checkFeriados(ctx: ValidateContext): Violation[] {
  const holidaySet = new Set(ctx.holidays);
  return ctx.assignments
    .filter((a) => holidaySet.has(a.date))
    .map((a) => ({
      tipo: "feriado_asignado",
      worker_rut: a.worker_rut,
      detalle: `${a.worker_rut} asignado en feriado ${a.date}`,
    }));
}

// ─── reglas 6-8: restricciones individuales ───────────────────────────────────

function checkConstraints(ctx: ValidateContext): Violation[] {
  const violations: Violation[] = [];

  const vacsByRut: Record<string, { desde: string; hasta: string }[]> = {};
  const prohibDaysByRut: Record<string, string[]> = {};
  const prohibShiftsByRut: Record<string, string[]> = {};

  for (const c of ctx.constraints) {
    const rut = ctx.workers.find((w) => w.$id === c.worker_id)?.rut;
    if (!rut) continue;

    if (c.tipo === "vacaciones" && c.fecha_desde && c.fecha_hasta) {
      if (!vacsByRut[rut]) vacsByRut[rut] = [];
      vacsByRut[rut].push({ desde: c.fecha_desde, hasta: c.fecha_hasta });
    } else if (c.tipo === "dia_prohibido" && c.valor) {
      if (!prohibDaysByRut[rut]) prohibDaysByRut[rut] = [];
      prohibDaysByRut[rut].push(c.valor);
    } else if (c.tipo === "turno_prohibido" && c.valor) {
      if (!prohibShiftsByRut[rut]) prohibShiftsByRut[rut] = [];
      prohibShiftsByRut[rut].push(c.valor);
    }
  }

  for (const a of ctx.assignments) {
    for (const vac of vacsByRut[a.worker_rut] ?? []) {
      if (a.date >= vac.desde && a.date <= vac.hasta) {
        violations.push({
          tipo: "vacaciones_asignadas",
          worker_rut: a.worker_rut,
          detalle: `${a.worker_rut} está de vacaciones el ${a.date}`,
        });
      }
    }
    if ((prohibDaysByRut[a.worker_rut] ?? []).includes(dayOfWeek(a.date))) {
      violations.push({
        tipo: "dia_prohibido_asignado",
        worker_rut: a.worker_rut,
        detalle: `${a.worker_rut} tiene prohibido el ${dayOfWeek(a.date)}`,
      });
    }
    if ((prohibShiftsByRut[a.worker_rut] ?? []).includes(a.shift_id)) {
      violations.push({
        tipo: "turno_prohibido_asignado",
        worker_rut: a.worker_rut,
        detalle: `${a.worker_rut} tiene prohibido el turno ${a.shift_id}`,
      });
    }
  }
  return violations;
}

// ─── entry point ──────────────────────────────────────────────────────────────

export function validateLocal(ctx: ValidateContext): Violation[] {
  return [
    ...checkHorasSemanales(ctx),
    ...checkDiasSemanales(ctx),
    ...checkDomingosLibres(ctx),
    ...checkCobertura(ctx),
    ...checkFeriados(ctx),
    ...checkConstraints(ctx),
  ];
}
