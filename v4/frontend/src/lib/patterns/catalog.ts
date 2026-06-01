import type { ShiftPatternDef, WeekPattern, DayShift } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function turno(start: string, end: string): DayShift {
  return { start, end };
}
const L = null; // libre

// Semana de 7 días [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
function semana(
  lun: DayShift | null,
  mar: DayShift | null,
  mie: DayShift | null,
  jue: DayShift | null,
  vie: DayShift | null,
  sab: DayShift | null,
  dom: DayShift | null,
): WeekPattern {
  return [lun, mar, mie, jue, vie, sab, dom];
}

// ─── catálogo de patrones ─────────────────────────────────────────────────────

const PATTERNS: ShiftPatternDef[] = [

  // ── Standalone (2 semanas) ───────────────────────────────────────────────
  {
    id: "ventas_standalone",
    label: "Standalone",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("09:00","18:30"), turno("09:00","18:30"),
        turno("09:00","18:30"), turno("09:00","18:30"),
        turno("09:00","18:00"), L, L,
      ),
      semana(
        turno("10:30","19:00"), turno("10:30","19:00"),
        turno("10:30","19:00"), turno("10:30","19:00"),
        turno("10:30","19:00"), turno("10:00","14:30"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Autoplaza (4 semanas) ────────────────────────────────────────────────
  {
    id: "optimo_autoplaza",
    label: "Autoplaza",
    areaNegocio: "ventas",
    rotationWeeks: [
      // Sem 1: 42h — Dom libre
      semana(
        turno("10:30","19:30"), L,
        turno("10:30","20:30"), turno("10:30","20:30"),
        turno("10:30","20:30"), turno("10:30","18:30"), L,
      ),
      // Sem 2: 42h — Dom trabajado
      semana(
        turno("12:30","20:30"), turno("13:30","20:30"),
        turno("12:30","20:30"), L,
        turno("13:00","21:00"), turno("13:00","21:00"), turno("11:00","20:00"),
      ),
      // Sem 3: 36h — Sáb+Dom libres (fin de semana libre)
      semana(
        turno("10:30","20:30"), turno("10:30","20:30"),
        L,
        turno("10:30","20:30"), turno("10:30","20:30"), L, L,
      ),
      // Sem 4: 42h — Dom trabajado
      semana(
        turno("11:30","20:30"), turno("13:30","20:30"),
        turno("13:30","20:30"), turno("13:30","20:30"),
        L, turno("10:30","19:30"), turno("11:00","20:00"),
      ),
    ],
    weeklyHours: [42, 42, 36, 42],
  },

  // ── Óptimo Arauco Maipú (4 semanas) — L-J 10:00-20:30 · V-S 10:00-21:00 · D 10:30-20:30 ──
  {
    id: "optimo_arauco_maipu",
    label: "Arauco Maipú",
    areaNegocio: "ventas",
    rotationWeeks: [
      // Sem 1: 42h — Dom libre — Sáb apertura
      semana(
        turno("10:00","19:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), turno("10:00","18:00"), L,
      ),
      // Sem 2: 42h — Dom trabajado — Sáb cierre
      semana(
        turno("12:00","20:00"), turno("13:00","20:00"),
        turno("13:00","20:00"), L,
        turno("13:00","21:00"), turno("13:00","21:00"), turno("10:30","20:30"),
      ),
      // Sem 3: 36h — Sáb+Dom libres (fin de semana libre)
      semana(
        turno("10:00","20:00"), turno("10:00","20:00"),
        L,
        turno("10:00","20:00"), turno("10:00","20:00"), L, L,
      ),
      // Sem 4: 42h — Dom trabajado — Sáb apertura extendida
      semana(
        turno("12:30","20:30"), turno("13:30","20:30"),
        turno("13:30","20:30"), turno("13:30","20:30"),
        L, turno("10:00","19:00"), turno("10:30","20:30"),
      ),
    ],
    weeklyHours: [42, 42, 36, 42],
  },

  // ── Óptimo Movicenter (4 semanas) — igual a ventas_mall_7d — 10:00-20:00 7 días ──
  {
    id: "optimo_movicenter",
    label: "Movicenter",
    areaNegocio: "ventas",
    rotationWeeks: [
      // Sem 1: 42h — Dom libre — Sáb apertura
      semana(
        turno("10:00","19:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), turno("10:00","18:00"), L,
      ),
      // Sem 2: 42h — Dom trabajado — Sáb cierre
      semana(
        turno("10:00","18:00"), turno("12:00","20:00"),
        turno("12:00","20:00"), L,
        turno("12:00","20:00"), turno("12:00","20:00"), turno("12:00","20:00"),
      ),
      // Sem 3: 36h — Sáb+Dom libres (fin de semana libre)
      semana(
        turno("10:00","20:00"), turno("10:00","20:00"),
        L,
        turno("10:00","20:00"), turno("10:00","20:00"), L, L,
      ),
      // Sem 4: 42h — Dom trabajado
      semana(
        turno("10:00","18:00"), turno("10:00","17:00"),
        turno("10:00","17:00"), turno("10:00","17:00"),
        L, turno("10:00","19:00"), turno("10:00","20:00"),
      ),
    ],
    weeklyHours: [42, 42, 36, 42],
  },

  // ── Óptimo Autopark (2 semanas) — L-V 09:30-19:00 · S 10:00-19:00 · D cerrado ──
  {
    id: "optimo_autopark",
    label: "Autopark",
    areaNegocio: "ventas",
    rotationWeeks: [
      // Sem 1: Lun libre
      semana(
        L, turno("09:30","19:00"),
        turno("09:30","19:00"), turno("09:30","19:00"),
        turno("09:30","19:00"), turno("10:00","19:00"), L,
      ),
      // Sem 2: Jue libre
      semana(
        turno("09:30","19:00"), turno("09:30","19:00"),
        turno("09:30","19:00"), L,
        turno("09:30","19:00"), turno("10:00","19:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Geely Oeste (2 semanas) ─────────────────────────────────────────────
  {
    id: "ventas_geely_oeste",
    label: "Geely Oeste",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), L,
        turno("10:00","18:00"), turno("10:00","18:00"), turno("11:00","19:00"),
      ),
      semana(
        turno("10:00","20:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), L, L,
      ),
    ],
    weeklyHours: [42, 36],
  },

  // ── Usados Oeste (2 semanas) ─────────────────────────────────────────────
  {
    id: "ventas_usados_oeste",
    label: "Usados Oeste",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("10:00","20:00"), turno("10:00","20:00"),
        L, L,
        turno("10:00","19:00"), turno("11:00","20:00"), turno("10:00","19:00"),
      ),
      semana(
        turno("10:00","19:00"), L,
        turno("10:30","20:00"), turno("10:30","20:00"),
        turno("10:30","19:00"), turno("10:00","19:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── KIA Oeste (2 semanas) ────────────────────────────────────────────────
  {
    id: "ventas_kia_oeste",
    label: "KIA Oeste",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("13:00","20:00"), turno("10:00","20:00"),
        L, L,
        turno("10:00","20:00"), turno("10:00","20:00"), turno("10:00","20:00"),
      ),
      semana(
        turno("10:00","17:00"), L,
        turno("10:30","20:00"), turno("10:30","20:00"),
        turno("10:30","20:00"), turno("10:30","20:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── DFSK Oeste (2 semanas) ───────────────────────────────────────────────
  {
    id: "ventas_dfsk_oeste",
    label: "DFSK Oeste",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("10:00","20:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), L, L,
      ),
      semana(
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), L,
        turno("10:00","16:00"), turno("10:30","19:30"), turno("11:30","19:30"),
      ),
    ],
    weeklyHours: [36, 42],
  },

  // ── DFSK Oeste 2 (2 semanas) ─────────────────────────────────────────────
  {
    id: "ventas_dfsk_oeste2",
    label: "DFSK Oeste 2",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        turno("10:00","20:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), L, L,
      ),
      semana(
        turno("10:00","18:00"), turno("12:00","20:00"),
        turno("10:00","18:00"), L,
        turno("10:00","16:00"), turno("10:30","19:30"), turno("11:30","19:30"),
      ),
    ],
    weeklyHours: [36, 42],
  },

  // ── Postventa Vista Hermosa (fijo, sin rotación) ─────────────────────────
  {
    id: "postventa_vista_hermosa",
    label: "Postventa Vista Hermosa",
    areaNegocio: "postventa",
    rotationWeeks: [
      semana(
        turno("08:30","17:30"), turno("08:30","17:30"),
        turno("08:30","18:30"), turno("08:30","18:30"),
        turno("08:30","17:30"), L, L,
      ),
    ],
    weeklyHours: [42],
  },

  // ── Postventa Standalone (2 semanas) ────────────────────────────────────
  {
    id: "postventa_standalone",
    label: "Postventa Standalone",
    areaNegocio: "postventa",
    rotationWeeks: [
      semana(
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","17:30"), L, L,
      ),
      semana(
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","16:30"), turno("09:00","14:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Postventa CAP (idéntico a Postventa Standalone) ─────────────────────
  {
    id: "postventa_cap",
    label: "Postventa CAP",
    areaNegocio: "postventa",
    rotationWeeks: [
      semana(
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","17:30"), L, L,
      ),
      semana(
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","16:30"), turno("09:00","14:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Postventa Mall Movicenter/Tobalaba/Quilín (2 semanas) ────────────────
  {
    id: "postventa_mall_mqt",
    label: "Postventa Mall (Movicenter / Tobalaba / Quilín)",
    areaNegocio: "postventa",
    rotationWeeks: [
      semana(
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","18:00"), turno("08:30","18:00"),
        turno("08:30","17:30"), L, L,
      ),
      semana(
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","17:00"), turno("08:30","17:00"),
        turno("08:30","16:30"), turno("09:00","14:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Postventa Mall Plaza Oeste (2 semanas) ───────────────────────────────
  {
    id: "postventa_mall_oeste",
    label: "Postventa Mall Plaza Oeste",
    areaNegocio: "postventa",
    rotationWeeks: [
      semana(
        turno("08:00","17:30"), turno("08:00","17:30"),
        turno("08:00","17:30"), turno("08:00","17:30"),
        turno("08:00","17:00"), L, L,
      ),
      semana(
        turno("08:00","16:30"), turno("08:00","16:30"),
        turno("08:00","16:30"), turno("08:00","16:30"),
        turno("08:00","16:00"), turno("09:00","14:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },
];

// ─── accesores ────────────────────────────────────────────────────────────────

const CATALOG = new Map<string, ShiftPatternDef>(
  PATTERNS.map((p) => [p.id, p]),
);

export function isBuiltIn(id: string): boolean {
  return CATALOG.has(id);
}

export function getPattern(id: string, override?: ShiftPatternDef): ShiftPatternDef | null {
  if (override && override.id === id) return override;
  return CATALOG.get(id) ?? null;
}

export function getPatternOrThrow(id: string, override?: ShiftPatternDef): ShiftPatternDef {
  const p = getPattern(id, override);
  if (!p) throw new Error(`Categoría de turno desconocida: ${id}`);
  return p;
}

export function patternFromRow(row: { id: string; label: string; areaNegocio: string; rotationJson: string; weeklyHoursJson: string }): ShiftPatternDef {
  return {
    id: row.id,
    label: row.label,
    areaNegocio: row.areaNegocio as "ventas" | "postventa",
    rotationWeeks: JSON.parse(row.rotationJson) as WeekPattern[],
    weeklyHours: JSON.parse(row.weeklyHoursJson) as number[],
  };
}

export function getAllPatterns(): ShiftPatternDef[] {
  return PATTERNS;
}

export function getPatternsByArea(area: "ventas" | "postventa"): ShiftPatternDef[] {
  return PATTERNS.filter((p) => p.areaNegocio === area);
}

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PATTERNS.map((p) => [p.id, p.label]),
);

const DOW_ABBR = ["L", "M", "X", "J", "V", "S", "D"] as const;

export function getWeeklyScheduleSummary(id: string, override?: ShiftPatternDef): string {
  const pattern = getPatternOrThrow(id, override);

  // Para cada día de la semana, calcular la cobertura total (todos los slots/semanas)
  const coverage: (string | null)[] = DOW_ABBR.map((_, dow) => {
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    for (const week of pattern.rotationWeeks) {
      const shift = week[dow];
      if (shift) {
        if (!minStart || shift.start < minStart) minStart = shift.start;
        if (!maxEnd || shift.end > maxEnd) maxEnd = shift.end;
      }
    }
    return minStart ? `${minStart}–${maxEnd}` : null;
  });

  // Agrupar días con mismo rango (omitir libres)
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cov = coverage[i];
    if (!cov) continue;
    if (!groups.has(cov)) { groups.set(cov, []); order.push(cov); }
    groups.get(cov)!.push(DOW_ABBR[i]);
  }

  return order.map((cov) => `${groups.get(cov)!.join("")} ${cov}`).join(" · ");
}

export function getOperatingHours(id: string, override?: ShiftPatternDef): string {
  const pattern = getPatternOrThrow(id, override);
  let minStart = "23:59";
  let maxEnd = "00:00";
  for (const week of pattern.rotationWeeks) {
    for (const shift of week) {
      if (!shift) continue;
      if (shift.start < minStart) minStart = shift.start;
      if (shift.end > maxEnd) maxEnd = shift.end;
    }
  }
  return minStart === "23:59" ? "" : `${minStart}–${maxEnd}`;
}

const DOW_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function getScheduleBreakdown(id: string, override?: ShiftPatternDef): { days: string; range: string }[] {
  const pattern = getPatternOrThrow(id, override);
  const coverage: (string | null)[] = Array.from({ length: 7 }, (_, dow) => {
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    for (const week of pattern.rotationWeeks) {
      const shift = week[dow];
      if (shift) {
        if (!minStart || shift.start < minStart) minStart = shift.start;
        if (!maxEnd || shift.end > maxEnd) maxEnd = shift.end;
      }
    }
    return minStart ? `${minStart}–${maxEnd}` : null;
  });
  const groups = new Map<string, number[]>();
  const order: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cov = coverage[i];
    if (!cov) continue;
    if (!groups.has(cov)) { groups.set(cov, []); order.push(cov); }
    groups.get(cov)!.push(i);
  }
  return order.map((cov) => {
    const indices = groups.get(cov)!;
    const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
    let days: string;
    if (indices.length === 1) {
      days = DOW_FULL[indices[0]];
    } else if (isConsecutive) {
      days = `${DOW_FULL[indices[0]]}–${DOW_FULL[indices[indices.length - 1]]}`;
    } else {
      days = indices.map((i) => DOW_FULL[i]).join(", ");
    }
    return { days, range: cov };
  });
}

export function getOperatingWindow(id: string, override?: ShiftPatternDef): { start: string; end: string } {
  const pattern = getPatternOrThrow(id, override);
  let minStart = "23:59";
  let maxEnd = "00:00";
  for (const week of pattern.rotationWeeks) {
    for (const shift of week) {
      if (!shift) continue;
      if (shift.start < minStart) minStart = shift.start;
      if (shift.end > maxEnd) maxEnd = shift.end;
    }
  }
  return {
    start: minStart === "23:59" ? "08:00" : minStart,
    end:   maxEnd  === "00:00" ? "20:00" : maxEnd,
  };
}
