"""
Modelos Pydantic — Shift Optimizer v2
Fuente de verdad del backend. Se expande con cada spec.
"""
from enum import Enum
from typing import Optional
from pydantic import BaseModel


# ─── Enums ────────────────────────────────────────────────────────────────────

class Clasificacion(str, Enum):
    standalone     = "standalone"
    mall_sin_dom   = "mall_sin_dom"
    mall_7d        = "mall_7d"
    mall_autopark  = "mall_autopark"


class TipoFranja(str, Enum):
    standalone = "standalone"
    autopark   = "autopark"
    movicenter = "movicenter"
    tqaoev     = "tqaoev"
    sur        = "sur"


class AreaNegocio(str, Enum):
    ventas    = "ventas"
    postventa = "postventa"


class Rol(str, Enum):
    admin          = "admin"
    jefe_sucursal  = "jefe_sucursal"


# ─── Entidades ────────────────────────────────────────────────────────────────

class AreaCatalog(BaseModel):
    id: str                     # codigo_area como string (ej: "1200")
    nombre_display: str         # "Local Nissan Irarrazaval 965"
    clasificacion: Clasificacion
    tipo_franja: TipoFranja
    comuna: str


# Stub — se expande en spec 002
class Branch(BaseModel):
    id: str
    codigo_area: str
    nombre: str
    tipo_franja: TipoFranja
    clasificacion: Clasificacion
    activa: bool = True
    creada_desde_excel: bool = True


# Stub — se expande en spec 002
class Worker(BaseModel):
    id: str
    rut: str
    nombre_completo: str
    branch_id: str
    area_negocio: AreaNegocio
    rotation_group: str         # ej: "V_M7", "P_SA"
    supervisor_nombre: Optional[str] = None
    activo: bool = True
    ultima_sync_excel: Optional[str] = None
