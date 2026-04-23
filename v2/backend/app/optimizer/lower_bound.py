"""
Cálculo del lower bound de dotación mínima requerida.
Fórmula de docs/math-formulation.md §5.
"""
from __future__ import annotations

import math

from app.models.domain import SolverInput


def calcular_lower_bound(inp: SolverInput) -> int:
    """
    Dotación mínima teórica para cubrir el mes sin violar las horas semanales.

    n_min = ceil(total_horas_abiertas / (horas_max_semana × n_semanas))

    El numerador es la suma de (cierre - apertura) de todos los días abiertos,
    asumiendo cobertura mínima de 1 persona en todo momento.
    El denominador es el máximo que puede aportar un trabajador en el mes.
    """
    horas_max: float = inp.parametros.get("horas_semanales_max", 42)
    n_weeks = len(inp.weeks)

    if n_weeks == 0:
        return 0

    total_horas = sum(
        (d.cierre_min - d.apertura_min) / 60.0
        for d in inp.days
        if d.abierto
    )

    if total_horas == 0:
        return 0

    horas_max_persona = horas_max * n_weeks
    return math.ceil(total_horas / horas_max_persona)
