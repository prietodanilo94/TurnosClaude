"""
Dataclasses internas del solver. No son modelos Pydantic — se construyen
a partir de los schemas de la API y circulan dentro del backend únicamente.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class ShiftInfo:
    id: str
    nombre_turno: str
    rotation_group: str
    horario_por_dia: Dict[str, Dict[str, str]]  # "lunes" -> {"inicio": "HH:MM", "fin": "HH:MM"}
    dias_aplicables: List[str]
    descuenta_colacion: bool

    def get_times(self, weekday: str) -> Tuple[int, int]:
        if weekday not in self.dias_aplicables:
            return 0, 0
        h = self.horario_por_dia.get(weekday)
        if not h:
            return 0, 0
        def parse_time(s: str) -> int:
            hw, mw = s.split(":")
            return int(hw) * 60 + int(mw)
        return parse_time(h["inicio"]), parse_time(h["fin"])

    def get_duracion_h(self, weekday: str) -> float:
        inicio, fin = self.get_times(weekday)
        duracion = fin - inicio
        if self.descuenta_colacion and duracion >= 360:
            duracion -= 60
        return duracion / 60.0


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
    rotation_group: str      # Importado de v2 payload
    workers: List[WorkerInfo]
    days: List[DayInfo]
    shifts: List[ShiftInfo]
    weeks: List[List[int]]   # lista de semanas; cada semana = indices 0-based dentro de `days`
    open_sundays: int        # cantidad de domingos abiertos en el mes
    parametros: Dict         # los Parametros del request, como dict
    # True si la semana tiene los 7 días dentro del mes (no es semana parcial inicio/fin)
    complete_week_flags: List[bool] = field(default_factory=list)
    # worker_rut -> horas trabajadas en el mes anterior para la primera semana parcial
    first_week_carryover: Dict[str, float] = field(default_factory=dict)


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
