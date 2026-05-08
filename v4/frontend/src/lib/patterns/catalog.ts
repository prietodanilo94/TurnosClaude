import type { ShiftPatternDef, ShiftCategory, WeekPattern, DayShift } from "@/types";

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

const CATALOG = new Map<ShiftCategory, ShiftPatternDef>(
  PATTERNS.map((p) => [p.id, p]),
);

export function getPattern(id: ShiftCategory): ShiftPatternDef {
  const p = CATALOG.get(id);
  if (!p) throw new Error(`Categoría de turno desconocida: ${id}`);
  return p;
}

export function getAllPatterns(): ShiftPatternDef[] {
  return PATTERNS;
}

export function getPatternsByArea(area: "ventas" | "postventa"): ShiftPatternDef[] {
  return PATTERNS.filter((p) => p.areaNegocio === area);
}

export const CATEGORY_LABELS: Record<ShiftCategory, string> = Object.fromEntries(
  PATTERNS.map((p) => [p.id, p.label]),
) as Record<ShiftCategory, string>;

const DOW_ABBR = ["L", "M", "X", "J", "V", "S", "D"] as const;

export function getWeeklyScheduleSummary(id: ShiftCategory): string {
  const pattern = getPattern(id);

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

export function getOperatingHours(id: ShiftCategory): string {
  const pattern = getPattern(id);
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

export function getOperatingWindow(id: ShiftCategory): { start: string; end: string } {
  const pattern = getPattern(id);
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
