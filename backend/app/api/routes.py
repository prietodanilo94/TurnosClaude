from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.calendar import build_solver_input
from app.core.validators import validar_solucion
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
from app.optimizer.lower_bound import calcular_lower_bound

router = APIRouter()


@router.post("/optimize", response_model=OptimizeResponse, tags=["optimizer"])
async def optimize(payload: OptimizeRequest):
    if payload.parametros.modo == ModoProposal.ilp:
        raise HTTPException(status_code=501, detail="ILP solver no implementado todavía")

    solver_input = build_solver_input(payload)
    n_min = calcular_lower_bound(solver_input)
    n_workers = len(payload.workers)

    # Task 9 — 409 si la dotación es insuficiente
    if n_workers < n_min:
        return JSONResponse(
            status_code=409,
            content={
                "detail": (
                    f"Dotación insuficiente: necesitas al menos {n_min} trabajadores "
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

    output = solve_greedy(solver_input)

    rut_to_slot = {w.rut: i + 1 for i, w in enumerate(payload.workers)}
    assignments_out = [
        AssignmentOut(
            worker_slot=rut_to_slot[a.worker_rut],
            worker_rut=a.worker_rut,
            date=a.date,
            shift_id=a.shift_id,
        )
        for a in output.asignaciones
    ]

    proposal = ProposalOut(
        id="prop_greedy_1",
        modo=ModoProposal.greedy,
        score=output.score,
        factible=output.factible,
        dotacion_minima_sugerida=n_min,
        asignaciones=assignments_out,
    )

    # Task 8 — diagnostico siempre incluye n_min real
    diagnostico = Diagnostico(
        dotacion_disponible=n_workers,
        dotacion_minima_requerida=n_min,
        dotacion_suficiente=n_workers >= n_min,
        mensajes=list(output.mensajes),
    )

    return OptimizeResponse(propuestas=[proposal], diagnostico=diagnostico)


@router.post("/validate", response_model=ValidateResponse, tags=["optimizer"])
async def validate(payload: ValidateRequest):
    violaciones = validar_solucion(payload.asignaciones, payload)
    return ValidateResponse(valido=len(violaciones) == 0, violaciones=violaciones)
