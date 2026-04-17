"""
Dataclasses internas del solver. No son modelos Pydantic — se construyen
a partir de los schemas de la API y circulan dentro del backend únicamente.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class ShiftInfo:
    id: str
    inicio_min: int      # minutos desde 00:00
    fin_min: int
    duracion_h: float    # ya descontada colación


@dataclass
class DayInfo:
    date: str            # "YYYY-MM-DD"
    day_index: int       # 1-based dentro del mes
    weekday: str         # "lunes" .. "domingo"
    iso_week: int        # número de semana ISO
    abierto: bool
    apertura_min: int    # minutos desde 00:00 (0 si cerrado)
    cierre_min: int      # minutos desde 00:00 (0 si cerrado)
    es_feriado: bool


@dataclass
class WorkerInfo:
    rut: str
    nombre: str
    vacaciones: Set[str] = field(default_factory=set)          # {"YYYY-MM-DD"}
    dias_prohibidos: Set[str] = field(default_factory=set)     # {"lunes", ...}
    turnos_prohibidos: Set[str] = field(default_factory=set)   # {shift_id}


@dataclass
class SolverInput:
    """Todo lo que necesita el solver para correr, ya pre-procesado."""
    workers: List[WorkerInfo]
    days: List[DayInfo]
    shifts: List[ShiftInfo]
    weeks: List[List[int]]   # lista de semanas; cada semana = lista de day_index
    open_sundays: int        # cantidad de domingos abiertos en el mes
    parametros: Dict         # los Parametros del request, como dict


@dataclass
class AssignmentResult:
    worker_rut: str
    date: str
    shift_id: str


@dataclass
class SolverOutput:
    factible: bool
    asignaciones: List[AssignmentResult]
    score: float
    mensajes: List[str] = field(default_factory=list)
