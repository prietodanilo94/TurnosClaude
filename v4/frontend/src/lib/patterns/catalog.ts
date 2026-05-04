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

  // ── Ventas Standalone (2 semanas) ────────────────────────────────────────
  {
    id: "ventas_standalone",
    label: "Ventas Standalone",
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

  // ── Ventas Autopark (2 semanas) ──────────────────────────────────────────
  {
    id: "ventas_autopark",
    label: "Ventas Autopark",
    areaNegocio: "ventas",
    rotationWeeks: [
      semana(
        L, turno("09:30","19:00"),
        turno("09:30","19:00"), turno("09:30","19:00"),
        turno("09:30","19:00"), turno("10:00","19:00"), L,
      ),
      semana(
        turno("09:30","19:00"), turno("09:30","19:00"),
        turno("09:30","19:00"), L,
        turno("09:30","19:00"), turno("10:00","19:00"), L,
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Ventas Mall 7 días (4 semanas) ───────────────────────────────────────
  // Aplica a: Movicenter, Tobalaba, Vespucio, Arauco, Egaña, Sur
  {
    id: "ventas_mall_7d",
    label: "Ventas Mall 7 días",
    areaNegocio: "ventas",
    rotationWeeks: [
      // Semana 1: 42h
      semana(
        turno("10:00","19:00"), L,
        turno("10:00","20:00"), turno("10:00","20:00"),
        turno("10:00","20:00"), turno("12:00","20:00"), L,
      ),
      // Semana 2: 42h
      semana(
        turno("10:00","18:00"), turno("12:00","20:00"),
        turno("12:00","20:00"), L,
        turno("12:00","20:00"), turno("12:00","20:00"), turno("12:00","20:00"),
      ),
      // Semana 3: 36h (intencionalmente — restricciones legales/internas)
      semana(
        turno("10:00","20:00"), turno("10:00","20:00"),
        L,
        turno("10:00","20:00"), turno("10:00","20:00"), L, L,
      ),
      // Semana 4: 42h
      semana(
        turno("10:00","18:00"), turno("10:00","17:00"),
        turno("10:00","17:00"), turno("10:00","17:00"),
        L, turno("10:00","19:00"), turno("10:00","20:00"),
      ),
    ],
    weeklyHours: [42, 42, 36, 42],
  },

  // ── Ventas Mall Apertura/Cierre (Oeste, Tobalaba, Vespucio, Egaña, Sur) ──
  // Slot 1 = siempre T.Apertura (libre Jue), Slot 2 = siempre T.Cierre (libre Vie).
  // El jefe asigna manualmente semana a semana; el sistema genera la plantilla base.
  {
    id: "ventas_mall_apertura_cierre",
    label: "Ventas Mall Autoplaza",
    areaNegocio: "ventas",
    fixedSlots: true,
    rotationWeeks: [
      // T.Apertura: libre Jue
      semana(
        turno("10:30","18:30"), turno("10:30","18:30"),
        turno("10:30","18:30"), L,
        turno("10:30","18:30"), turno("10:30","18:30"), turno("11:00","19:00"),
      ),
      // T.Cierre: libre Vie
      semana(
        turno("12:00","20:00"), turno("12:00","20:00"),
        turno("12:00","20:00"), turno("12:00","20:00"),
        L, turno("12:00","20:00"), turno("11:00","19:00"),
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Ventas Arauco (fixedSlots: Slot1=Apertura libre Jue, Slot2=Cierre libre Vie) ──
  {
    id: "ventas_mall_arauco",
    label: "Ventas Mall Arauco Maipu",
    areaNegocio: "ventas",
    fixedSlots: true,
    rotationWeeks: [
      // T.Apertura: libre Jue
      semana(
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), L,
        turno("10:00","18:00"), turno("10:00","18:00"), turno("10:30","18:30"),
      ),
      // T.Cierre: libre Vie
      semana(
        turno("12:30","20:30"), turno("12:30","20:30"),
        turno("12:30","20:30"), turno("12:30","20:30"),
        L, turno("13:00","21:00"), turno("12:30","20:30"),
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Ventas Mall Movicenter (fixedSlots: Slot1=Apertura libre Jue, Slot2=Cierre libre Vie) ──
  {
    id: "ventas_mall_movicenter",
    label: "Ventas Mall Movicenter",
    areaNegocio: "ventas",
    fixedSlots: true,
    rotationWeeks: [
      // T.Apertura: libre Jue
      semana(
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), L,
        turno("10:00","18:00"), turno("10:00","18:00"), turno("10:00","18:00"),
      ),
      // T.Cierre: libre Vie
      semana(
        turno("12:00","20:00"), turno("12:00","20:00"),
        turno("12:00","20:00"), turno("12:00","20:00"),
        L, turno("12:00","20:00"), turno("12:00","20:00"),
      ),
    ],
    weeklyHours: [42, 42],
  },

  // ── Ventas Mall Autopark (fixedSlots: Slot1=Apertura, Slot2=Cierre, Do siempre libre) ──
  {
    id: "ventas_mall_autopark",
    label: "Ventas Mall Autopark",
    areaNegocio: "ventas",
    fixedSlots: true,
    rotationWeeks: [
      // T.Apertura: Lu-Sa 10:00-18:00, Do libre
      semana(
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), turno("10:00","18:00"),
        turno("10:00","18:00"), turno("10:00","18:00"), L,
      ),
      // T.Cierre: Lu-Sa 11:00-19:00, Do libre
      semana(
        turno("11:00","19:00"), turno("11:00","19:00"),
        turno("11:00","19:00"), turno("11:00","19:00"),
        turno("11:00","19:00"), turno("11:00","19:00"), L,
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
