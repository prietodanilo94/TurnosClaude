// Fuente de verdad de tipos TypeScript para v2.

export interface AppwriteDoc {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export type Rol = "admin" | "jefe_sucursal";
export type TipoFranja = "standalone" | "autopark" | "movicenter" | "tqaoev" | "sur";
export type Clasificacion = "standalone" | "mall_sin_dom" | "mall_7d" | "mall_autopark";
export type AreaNegocio = "ventas" | "postventa";
export type Categoria = "principal" | "adicional";
export type TipoConstraint = "dia_prohibido" | "turno_prohibido" | "vacaciones";
export type ModoProposal = "ilp" | "greedy";
export type EstadoProposal =
  | "generada"
  | "publicada"
  | "seleccionada"
  | "exportada"
  | "descartada";
export type TipoHoliday = "irrenunciable";
export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export interface FranjaDia {
  apertura: string | null;
  cierre: string | null;
}

export type FranjaSemanal = Record<DiaSemana, FranjaDia>;

export interface AssignmentSlot {
  slot: number;
  date: string;
  shift_id: string;
}

export interface AreaCatalog extends AppwriteDoc {
  nombre_display: string;
  clasificacion: Clasificacion;
  tipo_franja: TipoFranja;
  comuna: string;
}

export interface User extends AppwriteDoc {
  email: string;
  nombre_completo: string;
  rut?: string;
  rol: Rol;
  activo: boolean;
}

export interface Branch extends AppwriteDoc {
  codigo_area: string;
  nombre: string;
  tipo_franja: TipoFranja;
  clasificacion?: Clasificacion;
  activa: boolean;
  creada_desde_excel: boolean;
}

export interface BranchTypeConfig extends AppwriteDoc {
  nombre_display: string;
  franja_por_dia: FranjaSemanal | string;
  shifts_aplicables: string[];
}

export interface ShiftCatalog extends AppwriteDoc {
  nombre_display: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  descuenta_colacion: boolean;
  categoria: Categoria;
}

export interface Worker extends AppwriteDoc {
  rut: string;
  nombre_completo: string;
  branch_id: string;
  area_negocio?: AreaNegocio;
  rotation_group?: string;
  supervisor_nombre?: string;
  activo: boolean;
  ultima_sync_excel?: string;
}

export interface BranchManager extends AppwriteDoc {
  user_id: string;
  branch_id: string;
  asignado_desde: string;
  asignado_hasta?: string;
}

export interface Holiday extends AppwriteDoc {
  fecha: string;
  nombre: string;
  tipo: TipoHoliday;
  anio: number;
}

export interface WorkerConstraint extends AppwriteDoc {
  worker_id: string;
  tipo: TipoConstraint;
  valor?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  notas?: string;
  creado_por: string;
}

export interface Proposal extends AppwriteDoc {
  branch_id: string;
  anio: number;
  mes: number;
  modo: ModoProposal;
  score: number;
  factible: boolean;
  asignaciones: AssignmentSlot[] | string;
  dotacion_sugerida: number;
  parametros: Record<string, unknown>;
  estado: EstadoProposal;
  creada_por: string;
  seleccionada_por?: string;
  metrics?: string;
  publicada_por?: string;
  publicada_en?: string;
}

export interface Assignment extends AppwriteDoc {
  proposal_id: string;
  slot_numero: number;
  worker_id?: string;
  asignado_por?: string;
  asignado_en?: string;
}

export interface AuditLog extends AppwriteDoc {
  user_id: string;
  accion: string;
  entidad?: string;
  entidad_id?: string;
  metadata?: Record<string, unknown> | string;
}

export interface SyncReport {
  creados: number;
  actualizados: number;
  desactivados: number;
  sinCambios: number;
  errores: string[];
}

export type NombreTurnoV2 =
  | "apertura"
  | "cierre"
  | "completo"
  | "sabado"
  | "unico"
  | "opcion_a"
  | "opcion_b";

export interface HorarioDia {
  inicio: string;
  fin: string;
}

export interface ShiftV2 extends AppwriteDoc {
  nombre_display: string;
  rotation_group: string;
  nombre_turno: NombreTurnoV2;
  horario_por_dia: Record<string, HorarioDia>;
  descuenta_colacion: boolean;
  dias_aplicables: string[];
}
