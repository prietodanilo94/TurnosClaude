from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class Rol(str, Enum):
    admin = "admin"
    jefe_sucursal = "jefe_sucursal"


class TipoFranja(str, Enum):
    standalone = "standalone"
    autopark = "autopark"
    movicenter = "movicenter"
    tqaoev = "tqaoev"
    sur = "sur"


class Categoria(str, Enum):
    principal = "principal"
    adicional = "adicional"


class TipoConstraint(str, Enum):
    dia_prohibido = "dia_prohibido"
    turno_prohibido = "turno_prohibido"
    vacaciones = "vacaciones"


class ModoProposal(str, Enum):
    ilp = "ilp"
    greedy = "greedy"


class EstadoProposal(str, Enum):
    generada = "generada"
    seleccionada = "seleccionada"
    descartada = "descartada"


class TipoHoliday(str, Enum):
    irrenunciable = "irrenunciable"


class DiaSemana(str, Enum):
    lunes = "lunes"
    martes = "martes"
    miercoles = "miercoles"
    jueves = "jueves"
    viernes = "viernes"
    sabado = "sabado"
    domingo = "domingo"


# ─── Tipos auxiliares para JSON fields ────────────────────────────────────────

class FranjaDia(BaseModel):
    apertura: Optional[str] = None
    cierre: Optional[str] = None


class AssignmentSlot(BaseModel):
    slot: int
    date: str
    shift_id: str


# ─── Base ─────────────────────────────────────────────────────────────────────

class AppwriteDoc(BaseModel):
    id: str = Field(alias="$id")
    created_at: Optional[str] = Field(default=None, alias="$createdAt")
    updated_at: Optional[str] = Field(default=None, alias="$updatedAt")

    model_config = {"populate_by_name": True}


# ─── Colecciones ─────────────────────────────────────────────────────────────

class User(AppwriteDoc):
    email: str
    nombre_completo: str
    rut: Optional[str] = None
    rol: Rol
    activo: bool


class Branch(AppwriteDoc):
    codigo_area: str
    nombre: str
    tipo_franja: TipoFranja
    activa: bool
    creada_desde_excel: bool


class BranchTypeConfig(AppwriteDoc):
    nombre_display: str
    franja_por_dia: Dict[DiaSemana, FranjaDia]
    shifts_aplicables: List[str]


class ShiftCatalog(AppwriteDoc):
    nombre_display: str
    hora_inicio: str
    hora_fin: str
    duracion_minutos: int
    descuenta_colacion: bool
    categoria: Categoria


class Worker(AppwriteDoc):
    rut: str
    nombre_completo: str
    branch_id: str
    supervisor_nombre: Optional[str] = None
    activo: bool
    ultima_sync_excel: Optional[str] = None


class BranchManager(AppwriteDoc):
    user_id: str
    branch_id: str
    asignado_desde: str
    asignado_hasta: Optional[str] = None


class Holiday(AppwriteDoc):
    fecha: str
    nombre: str
    tipo: TipoHoliday
    anio: int


class WorkerConstraint(AppwriteDoc):
    worker_id: str
    tipo: TipoConstraint
    valor: Optional[str] = None
    fecha_desde: Optional[str] = None
    fecha_hasta: Optional[str] = None
    notas: Optional[str] = None
    creado_por: str


class Proposal(AppwriteDoc):
    branch_id: str
    anio: int
    mes: int
    modo: ModoProposal
    score: float
    factible: bool
    asignaciones: List[AssignmentSlot]
    dotacion_sugerida: int
    parametros: Dict[str, Any]
    estado: EstadoProposal
    creada_por: str
    seleccionada_por: Optional[str] = None


class Assignment(AppwriteDoc):
    proposal_id: str
    slot_numero: int
    worker_id: Optional[str] = None
    asignado_por: Optional[str] = None
    asignado_en: Optional[str] = None


class AuditLog(AppwriteDoc):
    user_id: str
    accion: str
    entidad: Optional[str] = None
    entidad_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# API schemas — POST /optimize y POST /validate
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Request sub-schemas ──────────────────────────────────────────────────────

class BranchInput(BaseModel):
    id: str
    codigo_area: str
    nombre: str
    tipo_franja: TipoFranja


class MonthInput(BaseModel):
    year: int = Field(..., ge=2024, le=2100)
    month: int = Field(..., ge=1, le=12)


class ShiftDef(BaseModel):
    """Definición de un turno del catálogo, ya filtrada para el tipo de franja."""
    id: str
    inicio: str                  # "HH:MM"
    fin: str                     # "HH:MM"
    duracion_minutos: int        # ya descontada colación si corresponde
    descuenta_colacion: bool


class ConstraintInput(BaseModel):
    tipo: TipoConstraint
    valor: Optional[str] = None  # dia_semana para dia_prohibido, shift_id para turno_prohibido
    desde: Optional[str] = None  # "YYYY-MM-DD" para vacaciones
    hasta: Optional[str] = None  # "YYYY-MM-DD" para vacaciones


class WorkerInput(BaseModel):
    rut: str
    nombre: str
    constraints: List[ConstraintInput] = Field(default_factory=list)


class Parametros(BaseModel):
    modo: ModoProposal = ModoProposal.ilp
    num_propuestas: int = Field(default=3, ge=1, le=10)
    horas_semanales_max: int = Field(default=42, ge=1, le=60)
    horas_semanales_obj: int = Field(default=42, ge=1, le=60)
    dias_maximos_consecutivos: int = Field(default=6, ge=1, le=7)
    domingos_libres_minimos: int = Field(default=2, ge=0, le=4)
    peak_desde: str = Field(default="17:00")
    cobertura_minima: int = Field(default=1, ge=1)
    cobertura_optima_peak: int = Field(default=2, ge=1)
    cobertura_optima_off_peak: int = Field(default=1, ge=1)
    priorizar_fin_de_semana: bool = True
    time_limit_seconds: int = Field(default=30, ge=5, le=120)
    descanso_entre_jornadas: bool = False
    # Pesos de la función objetivo
    peso_cobertura_peak: float = Field(default=10.0, ge=0)
    peso_finde: float = Field(default=5.0, ge=0)
    peso_balance: float = Field(default=3.0, ge=0)
    peso_ociosidad: float = Field(default=1.0, ge=0)


class OptimizeRequest(BaseModel):
    branch: BranchInput
    month: MonthInput
    workers: List[WorkerInput] = Field(..., min_length=1)
    holidays: List[str] = Field(default_factory=list)  # ["YYYY-MM-DD"]
    shift_catalog: List[ShiftDef] = Field(..., min_length=1)
    franja_por_dia: Dict[str, Optional[FranjaDia]]     # keys: lunes..domingo, valor null = cerrado
    parametros: Parametros = Field(default_factory=Parametros)


# ─── Response sub-schemas ─────────────────────────────────────────────────────

class AssignmentOut(BaseModel):
    worker_slot: int             # posición 1-N (sin nombre real todavía)
    worker_rut: str
    date: str                    # "YYYY-MM-DD"
    shift_id: str


class ResumenSemana(BaseModel):
    semana_1: float = 0.0
    semana_2: float = 0.0
    semana_3: float = 0.0
    semana_4: float = 0.0
    semana_5: float = 0.0


class CoberturaInfo(BaseModel):
    horas_cubiertas: float
    horas_requeridas: float
    max_simultaneos: int


class ProposalOut(BaseModel):
    id: str
    modo: ModoProposal
    score: float
    factible: bool
    dotacion_minima_sugerida: int
    asignaciones: List[AssignmentOut]
    resumen_horas_por_trabajador: Dict[str, ResumenSemana] = Field(default_factory=dict)
    cobertura_por_dia: Dict[str, CoberturaInfo] = Field(default_factory=dict)


class Diagnostico(BaseModel):
    dotacion_disponible: int
    dotacion_minima_requerida: int
    dotacion_suficiente: bool
    mensajes: List[str] = Field(default_factory=list)


class OptimizeResponse(BaseModel):
    propuestas: List[ProposalOut]
    diagnostico: Diagnostico


# ─── Validate schemas ─────────────────────────────────────────────────────────

class ValidateRequest(OptimizeRequest):
    """Igual que OptimizeRequest pero con la solución a validar."""
    asignaciones: List[AssignmentOut]


class Violacion(BaseModel):
    tipo: str          # "horas_semanales_excedidas", "cobertura_insuficiente", etc.
    worker_rut: Optional[str] = None
    detalle: str


class ValidateResponse(BaseModel):
    valido: bool
    violaciones: List[Violacion] = Field(default_factory=list)
