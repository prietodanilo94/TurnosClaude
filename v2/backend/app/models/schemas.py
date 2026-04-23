from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

import json as _json

from pydantic import BaseModel, Field, field_validator


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


class OverrideType(str, Enum):
    cambiar_turno = "cambiar_turno"
    marcar_libre = "marcar_libre"
    marcar_trabajado = "marcar_trabajado"
    proteger_domingo = "proteger_domingo"


class ModoProposal(str, Enum):
    ilp = "ilp"
    greedy = "greedy"


class EstadoProposal(str, Enum):
    generada = "generada"
    publicada = "publicada"
    seleccionada = "seleccionada"
    exportada = "exportada"
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

class HorarioDia(BaseModel):
    inicio: str
    fin: str

class ShiftInfoV2(BaseModel):
    id: str
    nombre_display: str
    rotation_group: str
    nombre_turno: str
    horario_por_dia: Dict[str, HorarioDia]
    descuenta_colacion: bool
    dias_aplicables: List[str]


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


def _maybe_parse_json(value: Any) -> Any:
    if isinstance(value, str):
        return _json.loads(value)
    return value


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
    clasificacion: Optional[str] = None
    activa: bool
    creada_desde_excel: bool


class BranchTypeConfig(AppwriteDoc):
    nombre_display: str
    franja_por_dia: Dict[DiaSemana, FranjaDia]
    shifts_aplicables: List[str]

    @field_validator("franja_por_dia", mode="before")
    @classmethod
    def parse_franja_por_dia(cls, value: Any) -> Any:
        return _maybe_parse_json(value)


class ShiftCatalog(AppwriteDoc):
    nombre_display: str
    hora_inicio: str
    hora_fin: str
    duracion_minutos: int
    descuenta_colacion: bool
    categoria: Categoria


class ShiftCatalogV2(AppwriteDoc):
    nombre_display: str
    rotation_group: str
    nombre_turno: str
    horario_por_dia: Dict[str, HorarioDia]
    descuenta_colacion: bool
    dias_aplicables: List[str]

    @field_validator("horario_por_dia", mode="before")
    @classmethod
    def parse_horario_por_dia(cls, value: Any) -> Any:
        return _maybe_parse_json(value)


class Worker(AppwriteDoc):
    rut: str
    nombre_completo: str
    branch_id: str
    area_negocio: Optional[str] = None
    rotation_group: Optional[str] = None
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
    metrics: Optional[Dict[str, Any]] = None

    @field_validator("asignaciones", "parametros", "metrics", mode="before")
    @classmethod
    def parse_json_fields(cls, value: Any) -> Any:
        return _maybe_parse_json(value)


class Assignment(AppwriteDoc):
    proposal_id: str
    slot_numero: int
    worker_id: Optional[str] = None
    asignado_por: Optional[str] = None
    asignado_en: Optional[str] = None


class SlotOverride(AppwriteDoc):
    proposal_id: str
    fecha: str
    slot_numero: Optional[int] = None
    tipo: OverrideType
    shift_id_original: Optional[str] = None
    shift_id_nuevo: Optional[str] = None
    notas: Optional[str] = None
    creado_por: str


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


class ShiftDef(BaseModel):  # deprecated, usar ShiftInfoV2
    """Definición de un turno v1."""
    id: str
    inicio: str
    fin: str
    duracion_minutos: int
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
    modo: ModoProposal = Field(
        default=ModoProposal.ilp,
        description="Solver a usar. 'ilp' es óptimo global; 'greedy' es más rápido.",
    )
    num_propuestas: int = Field(
        default=3, ge=1, le=10,
        description="Cuántas propuestas distintas generar. El solver hace su mejor esfuerzo; puede devolver menos si el problema es muy restringido.",
    )
    horas_semanales_max: int = Field(
        default=42, ge=1, le=60,
        description="Máximo de horas trabajadas por semana ISO por trabajador (legislación chilena: 45h, convenio típico retail: 42h).",
    )
    horas_semanales_min: int = Field(
        default=41, ge=1, le=60,
        description="Mínimo de horas semanales por trabajador. El solver intentará llegar a horas_semanales_max; si no es posible, acepta hasta este piso.",
    )
    horas_semanales_obj: int = Field(
        default=42, ge=1, le=60,
        description="Horas objetivo semanales por trabajador (se usa para cálculo de balance; generalmente igual a horas_semanales_max).",
    )
    dias_maximos_consecutivos: int = Field(
        default=6, ge=1, le=7,
        description="Máximo de días trabajados consecutivos por semana (legislación chilena: 6).",
    )
    domingos_libres_minimos: int = Field(
        default=2, ge=0, le=4,
        description="Mínimo de domingos libres en el mes. Si el mes tiene menos domingos abiertos que este valor, se relaja proporcionalmente.",
    )
    peak_desde: str = Field(
        default="17:00",
        description="Hora a partir de la cual se considera 'peak'. Formato HH:MM.",
    )
    cobertura_minima: int = Field(
        default=1, ge=1,
        description="Mínimo de trabajadores simultáneos en cualquier slot de 30 min durante horario abierto.",
    )
    cobertura_optima_peak: int = Field(
        default=2, ge=1,
        description="Dotación ideal durante peak (se premia alcanzarla; superarla genera penalización de ociosidad).",
    )
    cobertura_optima_off_peak: int = Field(
        default=1, ge=1,
        description="Dotación ideal fuera de peak.",
    )
    priorizar_fin_de_semana: bool = Field(
        default=True,
        description="Si True, el greedy llena primero sábados y domingos (mayor demanda en retail).",
    )
    time_limit_seconds: int = Field(
        default=60, ge=5, le=180,
        description="Tiempo máximo por ejecución del solver ILP. Para casos con ≤30 trabajadores, 60s cubre la mayoría. Máx 180s.",
    )
    descanso_entre_jornadas: bool = Field(
        default=False,
        description="Si True, impone descanso mínimo de 10h entre jornadas consecutivas. Desactivado por defecto porque los turnos típicos no generan conflicto.",
    )
    # ── Pesos de la función objetivo (math-formulation.md §4) ─────────────────
    # α=10: cobertura peak es la prioridad máxima (impacto directo en ventas).
    # β=5: fines de semana son alta demanda en retail, necesitan dotación extra.
    # γ=3: balance es importante para equidad laboral, pero secundario al servicio.
    # δ=1: penaliza exceso de cobertura levemente; evita saturación sin sacrificar servicio.
    peso_cobertura_peak: float = Field(
        default=10.0, ge=0,
        description="α: peso de la cobertura en horario peak (§4.1). Prioridad máxima.",
    )
    peso_finde: float = Field(
        default=5.0, ge=0,
        description="β: peso de dotación en fines de semana (§4.2).",
    )
    peso_balance: float = Field(
        default=3.0, ge=0,
        description="γ: peso del balance de horas entre trabajadores (§4.3). Equidad laboral.",
    )
    peso_ociosidad: float = Field(
        default=1.0, ge=0,
        description="δ: penalización por cobertura en exceso respecto al óptimo deseado (§4.4).",
    )


class OptimizeRequest(BaseModel):
    branch: BranchInput
    rotation_group: str
    month: MonthInput
    workers: List[WorkerInput] = Field(..., min_length=1)
    holidays: List[str] = Field(default_factory=list)  # ["YYYY-MM-DD"]
    shift_catalog: List[ShiftInfoV2] = Field(..., min_length=1)
    franja_por_dia: Dict[str, Optional[FranjaDia]]     # keys: lunes..domingo, valor null = cerrado
    carryover_horas: Dict[str, float] = Field(default_factory=dict)
    # worker_rut -> horas ya trabajadas en semana ISO de días del mes anterior
    parametros: Parametros = Field(default_factory=Parametros)

    @field_validator("franja_por_dia", mode="before")
    @classmethod
    def parse_franja_string(cls, v: Any) -> Any:
        return _json.loads(v) if isinstance(v, str) else v

    model_config = {
        "json_schema_extra": {
            "example": {
                "branch": {"id": "branch_1200", "codigo_area": "1200", "nombre": "NISSAN IRARRÁZAVAL", "tipo_franja": "autopark"},
                "month": {"year": 2026, "month": 5},
                "workers": [
                    {"rut": "17286931-9", "nombre": "ABARZUA VARGAS ANDREA", "constraints": [
                        {"tipo": "dia_prohibido", "valor": "martes"},
                        {"tipo": "vacaciones", "desde": "2026-05-10", "hasta": "2026-05-14"},
                    ]},
                    {"rut": "12345678-9", "nombre": "GONZALEZ PEREZ CARLOS", "constraints": []},
                    {"rut": "98765432-1", "nombre": "LOPEZ RAMIREZ MARIA",  "constraints": []},
                ],
                "holidays": ["2026-05-01", "2026-05-21"],
                "shift_catalog": [
                    {"id": "S_09_19", "inicio": "09:00", "fin": "19:00", "duracion_minutos": 600, "descuenta_colacion": True},
                ],
                "franja_por_dia": {
                    "lunes": {"apertura": "09:00", "cierre": "19:00"},
                    "martes": {"apertura": "09:00", "cierre": "19:00"},
                    "miercoles": {"apertura": "09:00", "cierre": "19:00"},
                    "jueves": {"apertura": "09:00", "cierre": "19:00"},
                    "viernes": {"apertura": "09:00", "cierre": "19:00"},
                    "sabado": {"apertura": "09:00", "cierre": "14:00"},
                    "domingo": None,
                },
                "parametros": {
                    "modo": "ilp", "num_propuestas": 3, "horas_semanales_max": 42,
                    "cobertura_minima": 1, "peak_desde": "17:00",
                },
            }
        }
    }


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


class ProposalMetricsOut(BaseModel):
    score: float
    horas_promedio: float
    desviacion_horas: float
    cobertura_peak_pct: float
    turnos_cortos_count: int
    fin_semana_completo_count: int


class ProposalOut(BaseModel):
    id: str
    modo: ModoProposal
    score: float
    factible: bool
    dotacion_minima_sugerida: int
    asignaciones: List[AssignmentOut]
    metrics: Optional[ProposalMetricsOut] = None
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

    model_config = {
        "json_schema_extra": {
            "example": {
                "propuestas": [{
                    "id": "prop_ilp_1", "modo": "ilp", "score": 98.7, "factible": True,
                    "dotacion_minima_sugerida": 2,
                    "asignaciones": [
                        {"worker_slot": 1, "worker_rut": "17286931-9", "date": "2026-05-04", "shift_id": "S_09_19"},
                        {"worker_slot": 2, "worker_rut": "12345678-9", "date": "2026-05-04", "shift_id": "S_09_19"},
                    ],
                    "resumen_horas_por_trabajador": {},
                    "cobertura_por_dia": {},
                }],
                "diagnostico": {
                    "dotacion_disponible": 3, "dotacion_minima_requerida": 2,
                    "dotacion_suficiente": True, "mensajes": ["ILP status: OPTIMAL"],
                },
            }
        }
    }


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


# ─── Recálculo parcial (Spec 009) ─────────────────────────────────────────────

class AssignmentFija(BaseModel):
    """Una asignación fuera del rango de recálculo que el solver debe respetar."""
    worker_rut: str
    date: str       # "YYYY-MM-DD"
    shift_id: str


class PartialRange(BaseModel):
    """Rango de fechas sobre el que se ejecuta el recálculo."""
    desde: str      # "YYYY-MM-DD" inclusive
    hasta: str      # "YYYY-MM-DD" inclusive


class PartialOptimizeRequest(OptimizeRequest):
    """
    Igual que OptimizeRequest pero acotado a un rango de fechas.
    `workers` debe contener solo los disponibles en el rango.
    """
    partial_range: PartialRange
    assignments_fijas: List[AssignmentFija] = Field(
        default_factory=list,
        description="Asignaciones fuera del rango que no se tocan. "
                    "Sus horas se descuentan del presupuesto semanal.",
    )
    workers_excluidos: List[str] = Field(
        default_factory=list,
        description="RUTs de workers no disponibles en el rango. "
                    "Sus assignments_fijas se mantienen intactas.",
    )

# ── Calendar export (vista calendario para jefe) ─────────────────────────────

class WorkerCalendarInfo(BaseModel):
    slot: int
    nombre: str

class AssignmentCalendarInfo(BaseModel):
    slot: int
    date: str    # "YYYY-MM-DD"
    inicio: str  # "HH:MM"
    fin: str     # "HH:MM"

class CalendarExportRequest(BaseModel):
    branch_nombre: str
    codigo_area: str
    year: int
    month: int
    workers: List[WorkerCalendarInfo]
    assignments: List[AssignmentCalendarInfo]

