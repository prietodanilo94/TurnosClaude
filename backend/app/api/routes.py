import dataclasses
import random
from typing import FrozenSet

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.calendar import build_solver_input
from app.core.validators import validar_solucion
from app.models.domain import AssignmentResult, SolverInput, SolverOutput
from app.models.schemas import (
    AssignmentOut,
    Diagnostico,
    ModoProposal,
    OptimizeRequest,
    OptimizeResponse,
    ProposalOut,
    ValidateRequest,
    ValidateResponse,
)
from app.optimizer.greedy import solve_greedy
from app.optimizer.ilp import solve_ilp
from app.optimizer.lower_bound import calcular_lower_bound

router = APIRouter()

_WEIGHT_KEYS = ("peso_cobertura_peak", "peso_finde", "peso_balance", "peso_ociosidad")
_MAX_ATTEMPTS_FACTOR = 5


def _perturb_input(inp: SolverInput, seed: int, factor: float = 0.25) -> SolverInput:
    """Devuelve una copia de inp con pesos perturbados ±factor y workers mezclados."""
    rng = random.Random(seed)
    new_params = dict(inp.parametros)
    for key in _WEIGHT_KEYS:
        if key in new_params and float(new_params[key]) > 0:
            new_params[key] = max(0.01, float(new_params[key]) * (1 + rng.uniform(-factor, factor)))
    new_workers = list(inp.workers)
    rng.shuffle(new_workers)
    return dataclasses.replace(inp, workers=new_workers, parametros=new_params)


def _fingerprint(asignaciones: list[AssignmentResult]) -> FrozenSet[tuple]:
    return frozenset((a.worker_rut, a.date, a.shift_id) for a in asignaciones)


def _build_assignments_out(
    asignaciones: list[AssignmentResult],
    rut_to_slot: dict[str, int],
) -> list[AssignmentOut]:
    return [
        AssignmentOut(
            worker_slot=rut_to_slot[a.worker_rut],
            worker_rut=a.worker_rut,
            date=a.date,
            shift_id=a.shift_id,
        )
        for a in asignaciones
    ]


@router.post("/optimize", response_model=OptimizeResponse, tags=["optimizer"])
async def optimize(payload: OptimizeRequest):
    solver_input = build_solver_input(payload)
    n_min = calcular_lower_bound(solver_input)
    n_workers = len(payload.workers)

    if n_workers < n_min:
        return JSONResponse(
            status_code=409,
            content={
                "detail": (
                    f"Dotacion insuficiente: necesitas al menos {n_min} trabajadores "
                    f"para cubrir esta sucursal este mes; tienes {n_workers}."
                ),
                "diagnostico": {
                    "dotacion_disponible": n_workers,
                    "dotacion_minima_requerida": n_min,
                    "dotacion_suficiente": False,
                    "mensajes": [
                        f"Necesitas al menos {n_min} trabajadores para cubrir esta "
                        f"sucursal este mes; tienes {n_workers}."
                    ],
                },
            },
        )

    is_ilp = payload.parametros.modo == ModoProposal.ilp
    n_target = payload.parametros.num_propuestas
    rut_to_slot = {w.rut: i + 1 for i, w in enumerate(payload.workers)}

    proposals: list[ProposalOut] = []
    seen: set[FrozenSet[tuple]] = set()
    last_output: SolverOutput | None = None

    for attempt in range(n_target * _MAX_ATTEMPTS_FACTOR):
        if is_ilp:
            # ILP: la diversidad viene de la restricción de exclusión;
            # perturbar pesos no garantiza una solución distinta.
            inp = solver_input
            output = solve_ilp(inp, excluded_fingerprints=list(seen))
        else:
            inp = solver_input if attempt == 0 else _perturb_input(solver_input, seed=attempt)
            output = solve_greedy(inp)

        if not output.factible:
            continue

        fp = _fingerprint(output.asignaciones)
        if fp in seen:
            continue

        seen.add(fp)
        last_output = output
        proposal_mode = ModoProposal.ilp if is_ilp else ModoProposal.greedy
        proposal_id = f"prop_{proposal_mode.value}_{len(proposals) + 1}"

        proposals.append(
            ProposalOut(
                id=proposal_id,
                modo=proposal_mode,
                score=output.score,
                factible=True,
                dotacion_minima_sugerida=n_min,
                asignaciones=_build_assignments_out(output.asignaciones, rut_to_slot),
            )
        )

        if len(proposals) >= n_target:
            break

    if not proposals:
        # El lower bound pasó pero el solver no encontró ninguna solución factible.
        # Causas típicas: restricciones individuales muy estrictas (vacaciones
        # simultáneas de varios workers, combinación de turnos prohibidos, etc.)
        solver_msgs = list(last_output.mensajes) if last_output else [
            "El solver no encontró ninguna solución factible con las restricciones dadas."
        ]
        return JSONResponse(
            status_code=422,
            content={
                "detail": "No se encontró ninguna solución factible con las restricciones dadas.",
                "diagnostico": {
                    "dotacion_disponible": n_workers,
                    "dotacion_minima_requerida": n_min,
                    "dotacion_suficiente": True,
                    "mensajes": solver_msgs,
                },
            },
        )

    diagnostico = Diagnostico(
        dotacion_disponible=n_workers,
        dotacion_minima_requerida=n_min,
        dotacion_suficiente=True,
        mensajes=list(last_output.mensajes) if last_output else [],
    )

    return OptimizeResponse(propuestas=proposals, diagnostico=diagnostico)


@router.post("/validate", response_model=ValidateResponse, tags=["optimizer"])
async def validate(payload: ValidateRequest):
    violaciones = validar_solucion(payload.asignaciones, payload)
    return ValidateResponse(valido=len(violaciones) == 0, violaciones=violaciones)
