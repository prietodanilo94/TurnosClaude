// frontend/src/types/models.ts — Shift Optimizer v2
// Fuente de verdad de tipos TypeScript. Se expande con cada spec.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Clasificacion = "standalone" | "mall_sin_dom" | "mall_7d" | "mall_autopark";

export type TipoFranja = "standalone" | "autopark" | "movicenter" | "tqaoev" | "sur";

export type AreaNegocio = "ventas" | "postventa";

export type Rol = "admin" | "jefe_sucursal";

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface AreaCatalog {
  $id: string;            // codigo_area como string (ej: "1200")
  nombre_display: string; // "Local Nissan Irarrazaval 965"
  clasificacion: Clasificacion;
  tipo_franja: TipoFranja;
  comuna: string;
}

// Stub — se expande en spec 002
export interface Branch {
  $id: string;
  codigo_area: string;
  nombre: string;
  tipo_franja: TipoFranja;
  clasificacion: Clasificacion;
  activa: boolean;
  creada_desde_excel: boolean;
}

// Stub — se expande en spec 002
export interface Worker {
  $id: string;
  rut: string;
  nombre_completo: string;
  branch_id: string;
  area_negocio: AreaNegocio;
  rotation_group: string; // ej: "V_M7", "P_SA"
  supervisor_nombre?: string;
  activo: boolean;
  ultima_sync_excel?: string;
}
