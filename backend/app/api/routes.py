from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.calendar import build_solver_input
from app.models.schemas import (
    AssignmentOut,
    Diagnostico,
    ModoProposal,
    OptimizeRequest,
    OptimizeResponse,
    ProposalOut,
    ValidateRequest,
)
from app.optimizer.greedy import solve_greedy

router = APIRouter()


@router.post("/optimize", response_model=OptimizeResponse, tags=["optimizer"])
async def optimize(payload: OptimizeRequest):
    if payload.parametros.modo == ModoProposal.ilp:
        raise HTTPException(status_code=501, detail="ILP solver no implementado todavía")

    solver_input = build_solver_input(payload)
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
        dotacion_minima_sugerida=len(payload.workers),  # lower_bound real en Task 7
        asignaciones=assignments_out,
    )

    diagnostico = Diagnostico(
        dotacion_disponible=len(payload.workers),
        dotacion_minima_requerida=1,  # lower_bound real en Task 7
        dotacion_suficiente=True,
        mensajes=output.mensajes,
    )

    return OptimizeResponse(propuestas=[proposal], diagnostico=diagnostico)


@router.post("/validate", tags=["optimizer"])
async def validate(payload: ValidateRequest):
    return JSONResponse(status_code=501, content={"detail": "Not implemented yet"})
