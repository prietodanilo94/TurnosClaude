// Tipos que espeja la API del optimizer (POST /optimize, POST /validate)

export interface ShiftDef {
  id: string;
  inicio: string;        // "HH:MM"
  fin: string;           // "HH:MM"
  duracion_minutos: number;
  descuenta_colacion: boolean;
}

export interface OptimizerAssignment {
  worker_slot: number;   // 1..N — índice de presentación
  worker_rut: string;    // RUT real
  date: string;          // "YYYY-MM-DD"
  shift_id: string;
}

export interface OptimizerProposal {
  id: string;
  modo: "ilp" | "greedy";
  score: number;
  factible: boolean;
  dotacion_minima_sugerida: number;
  asignaciones: OptimizerAssignment[];
}

export interface Diagnostico {
  dotacion_disponible: number;
  dotacion_minima_requerida: number;
  dotacion_suficiente: boolean;
  mensajes: string[];
}

export interface OptimizerResponse {
  propuestas: OptimizerProposal[];
  diagnostico: Diagnostico;
}

export interface Violation {
  tipo: string;
  worker_rut?: string;
  detalle: string;
}

// Representación interna de una asignación dentro del calendario.
// Deriva de OptimizerAssignment pero tiene un id estable para DnD.
export interface CalendarAssignment {
  id: string;            // "{worker_rut}_{date}_{shift_id}"
  worker_slot: number;
  worker_rut: string;
  date: string;          // "YYYY-MM-DD"
  shift_id: string;
}
