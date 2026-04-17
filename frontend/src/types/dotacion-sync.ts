import type { ParsedRow, ParseError } from "@/lib/excel-parser";
import type { TipoFranja } from "./models";

export type { ParsedRow, ParseError };

export type WorkerStatus = "nuevo" | "actualizado" | "sin_cambios" | "a_desactivar";

export interface WorkerDiff {
  row: ParsedRow;
  status: WorkerStatus;
  workerId?: string;   // si ya existe en Appwrite
  branchId?: string;
}

export interface BranchDiff {
  codigoArea: string;
  nombre: string;
  isNew: boolean;
  branchId?: string;          // si ya existe
  tipoFranja?: TipoFranja;    // admin la asigna si isNew
  workerCount: number;
}

export interface DotacionDiff {
  workers: WorkerDiff[];
  branches: BranchDiff[];
  toDeactivate: { workerId: string; rut: string; nombre: string }[];
}

export interface SyncReport {
  creados: number;
  actualizados: number;
  desactivados: number;
  sinCambios: number;
  errores: string[];
}
