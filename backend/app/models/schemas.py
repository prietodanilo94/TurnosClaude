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
