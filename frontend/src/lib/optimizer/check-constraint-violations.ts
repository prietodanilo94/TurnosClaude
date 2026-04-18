import type { OptimizerConstraint } from "@/lib/exceptions/to-optimizer-constraint";
import type { OptimizerAssignment } from "@/types/optimizer";

export interface ConstraintViolation {
  workerRut: string;
  constraint: OptimizerConstraint;
  assignment: OptimizerAssignment;
}

interface WorkerConstraints {
  rut: string;
  constraints: OptimizerConstraint[];
}

// Verifica que las asignaciones del optimizador respeten las restricciones por trabajador.
// Solo chequea turno_prohibido; dia_prohibido y vacaciones se verifican en el backend.
export function checkConstraintViolations(
  assignments: OptimizerAssignment[],
  workers: WorkerConstraints[]
): ConstraintViolation[] {
  const constraintsByRut = new Map(workers.map((w) => [w.rut, w.constraints]));
  const violations: ConstraintViolation[] = [];

  for (const a of assignments) {
    const constraints = constraintsByRut.get(a.worker_rut) ?? [];
    for (const c of constraints) {
      if (c.tipo === "turno_prohibido" && c.valor === a.shift_id) {
        violations.push({ workerRut: a.worker_rut, constraint: c, assignment: a });
      }
    }
  }

  return violations;
}
