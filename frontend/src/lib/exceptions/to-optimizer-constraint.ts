import type { WorkerConstraint } from "@/types/models";

// Shape que espera el backend en POST /optimize → workers[].constraints[]
export interface OptimizerConstraint {
  tipo: "dia_prohibido" | "turno_prohibido" | "vacaciones";
  valor?: string;   // dia_semana | shift_id
  desde?: string;   // "YYYY-MM-DD"
  hasta?: string;   // "YYYY-MM-DD"
}

export function toOptimizerConstraint(c: WorkerConstraint): OptimizerConstraint {
  switch (c.tipo) {
    case "dia_prohibido":
      return { tipo: "dia_prohibido", valor: c.valor };
    case "turno_prohibido":
      return { tipo: "turno_prohibido", valor: c.valor };
    case "vacaciones":
      return { tipo: "vacaciones", desde: c.fecha_desde, hasta: c.fecha_hasta };
  }
}
