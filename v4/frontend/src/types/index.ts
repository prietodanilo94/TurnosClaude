export type AreaNegocio = "ventas" | "postventa";

export type ShiftCategory =
  | "ventas_standalone"
  | "ventas_autopark"
  | "ventas_mall_7d"
  | "ventas_mall_apertura_cierre"
  | "ventas_mall_arauco"
  | "ventas_mall_movicenter"
  | "ventas_mall_autopark"
  | "postventa_vista_hermosa"
  | "postventa_standalone"
  | "postventa_cap"
  | "postventa_mall_mqt"  // Movicenter, Quilín, Tobalaba
  | "postventa_mall_oeste"; // Plaza Oeste

// Turno de un día: null = libre
export interface DayShift {
  start: string; // "09:00"
  end: string;   // "18:30"
}

// 7 días: [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
export type WeekPattern = (DayShift | null)[];

export interface ShiftPatternDef {
  id: ShiftCategory;
  label: string;
  areaNegocio: AreaNegocio;
  rotationWeeks: WeekPattern[]; // 1, 2 o 4 semanas
  weeklyHours: number[];
  fixedSlots?: boolean; // cada slot tiene patrón fijo (sin rotación semanal)
}

export interface BranchSummary {
  id: string;
  codigo: string;
  nombre: string;
  teams: {
    id: string;
    areaNegocio: AreaNegocio;
    categoria: ShiftCategory | null;
    workerCount: number;
  }[];
}

export interface WorkerRow {
  rut: string;
  nombre: string;
  codigoBranch: string;
  nombreBranch: string;
  areaNegocio: AreaNegocio;
  supervisor?: string;
  filaExcel: number;
}

export interface ParseResult {
  rows: WorkerRow[];
  errors: { fila: number; motivo: string }[];
}

// Slot en el calendario: un turno asignado a un número de slot
export interface CalendarSlot {
  slotNumber: number;
  // date -> turno del día (null = libre)
  days: Record<string, DayShift | null>;
}

export interface CalendarData {
  id: string;
  branchTeamId: string;
  year: number;
  month: number;
  slots: CalendarSlot[];
  // slotNumber (string) -> workerId | null
  assignments: Record<string, string | null>;
}

export interface WorkerInfo {
  id: string;
  rut: string;
  nombre: string;
  activo: boolean;
  esVirtual: boolean;
}
