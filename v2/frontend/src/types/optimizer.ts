export interface ShiftDef {
  id: string;
  inicio: string;
  fin: string;
  duracion_minutos: number;
  descuenta_colacion: boolean;
}

export interface OptimizerAssignment {
  worker_slot: number;
  worker_rut: string;
  date: string;
  shift_id: string;
}

export interface ProposalMetrics {
  score: number;
  horas_promedio: number;
  desviacion_horas: number;
  cobertura_peak_pct: number;
  turnos_cortos_count: number;
  fin_semana_completo_count: number;
}

export interface OptimizerProposal {
  id: string;
  modo: "ilp" | "greedy";
  score: number;
  factible: boolean;
  dotacion_minima_sugerida: number;
  asignaciones: OptimizerAssignment[];
  metrics?: ProposalMetrics;
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

export interface CalendarAssignment {
  id: string;
  worker_slot: number;
  worker_rut: string;
  date: string;
  shift_id: string;
}
