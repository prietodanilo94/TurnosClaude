import dataclasses
import random
from typing import FrozenSet

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, Response

from app.api.deps import require_admin, get_current_user as require_auth
from app.core.calendar import build_solver_input
from app.core.validators import validar_solucion
from app.models.domain import AssignmentResult, SolverInput, SolverOutput
from app.models.export import ExportRequest
from app.models.schemas import (
    AssignmentOut,
    Diagnostico,
    ModoProposal,
    OptimizeRequest,
    OptimizeResponse,
    PartialOptimizeRequest,
    ProposalMetricsOut,
    ProposalOut,
    ValidateRequest,
    ValidateResponse,
)
from app.optimizer.greedy import solve_greedy
from app.optimizer.ilp import solve_ilp
from app.optimizer.lower_bound import calcular_lower_bound
from app.optimizer.partial import setup_partial_problem
from app.optimizer.scoring import compute_metrics
from app.services import appwrite_client as ac
from app.services.appwrite_jwt import AppwriteUser
from app.services.excel_exporter import build_filename, export_proposal_to_xlsx
from app.services.calendar_exporter import build_calendar_filename, export_calendar_to_xlsx
from app.models.schemas import CalendarExportRequest
from app.services.proposal_fetcher import ExportError, fetch_export_dataset

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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


def _filter_month_assignments(
    asignaciones: list[AssignmentResult], year: int, month: int
) -> list[AssignmentResult]:
    prefix = f"{year:04d}-{month:02d}-"
    return [a for a in asignaciones if a.date.startswith(prefix)]


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

        raw_metrics = compute_metrics(output, inp)
        metrics_out = ProposalMetricsOut(**dataclasses.asdict(raw_metrics))

        proposals.append(
            ProposalOut(
                id=proposal_id,
                modo=proposal_mode,
                score=output.score,
                factible=True,
                dotacion_minima_sugerida=n_min,
                asignaciones=_build_assignments_out(output.asignaciones, rut_to_slot),
                metrics=metrics_out,
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


@router.post("/optimize/partial", response_model=OptimizeResponse, tags=["optimizer"])
async def optimize_partial(
    payload: PartialOptimizeRequest,
):
    full_input = build_solver_input(payload)
    partial_ctx = setup_partial_problem(payload, full_input)

    excluidos = set(payload.workers_excluidos)
    filtered_input = dataclasses.replace(
        full_input,
        workers=[w for w in full_input.workers if w.rut not in excluidos],
    )

    n_workers = len(filtered_input.workers)
    if n_workers == 0:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "No hay trabajadores disponibles en el rango parcial.",
                "diagnostico": {
                    "dotacion_disponible": 0,
                    "dotacion_minima_requerida": 0,
                    "dotacion_suficiente": False,
                    "mensajes": ["Todos los workers fueron excluidos."],
                },
            },
        )

    is_ilp = payload.parametros.modo == ModoProposal.ilp
    n_target = payload.parametros.num_propuestas
    rut_to_slot = {w.rut: i + 1 for i, w in enumerate(filtered_input.workers)}

    proposals: list[ProposalOut] = []
    seen: set[FrozenSet[tuple]] = set()
    last_output: SolverOutput | None = None

    for attempt in range(n_target * _MAX_ATTEMPTS_FACTOR):
        if is_ilp:
            output = solve_ilp(
                filtered_input,
                excluded_fingerprints=list(seen),
                partial_context=partial_ctx,
            )
        else:
            inp = (
                filtered_input if attempt == 0
                else _perturb_input(filtered_input, seed=attempt)
            )
            output = solve_greedy(inp, partial_context=partial_ctx)

        if not output.factible:
            last_output = output
            continue

        fp = _fingerprint(output.asignaciones)
        if fp in seen:
            continue

        seen.add(fp)
        last_output = output
        proposal_mode = ModoProposal.ilp if is_ilp else ModoProposal.greedy
        proposal_id = f"prop_partial_{proposal_mode.value}_{len(proposals) + 1}"

        raw_metrics = compute_metrics(output, filtered_input)
        metrics_out = ProposalMetricsOut(**dataclasses.asdict(raw_metrics))

        proposals.append(
            ProposalOut(
                id=proposal_id,
                modo=proposal_mode,
                score=output.score,
                factible=True,
                dotacion_minima_sugerida=n_workers,
                asignaciones=_build_assignments_out(output.asignaciones, rut_to_slot),
                metrics=metrics_out,
            )
        )

        if len(proposals) >= n_target:
            break

    if not proposals:
        solver_msgs = (
            list(last_output.mensajes) if last_output
            else ["El solver no encontró ninguna solución factible para el rango parcial."]
        )
        return JSONResponse(
            status_code=422,
            content={
                "detail": "No se encontró ninguna solución factible para el rango parcial.",
                "diagnostico": {
                    "dotacion_disponible": n_workers,
                    "dotacion_minima_requerida": 0,
                    "dotacion_suficiente": False,
                    "mensajes": solver_msgs,
                },
            },
        )

    diagnostico = Diagnostico(
        dotacion_disponible=n_workers,
        dotacion_minima_requerida=0,
        dotacion_suficiente=True,
        mensajes=list(last_output.mensajes) if last_output else [],
    )
    return OptimizeResponse(propuestas=proposals, diagnostico=diagnostico)


@router.post("/validate", response_model=ValidateResponse, tags=["optimizer"])
async def validate(payload: ValidateRequest):
    violaciones = validar_solucion(payload.asignaciones, payload)
    return ValidateResponse(valido=len(violaciones) == 0, violaciones=violaciones)


@router.post("/export", tags=["export"])
async def export_excel(
    payload: ExportRequest,
    user: AppwriteUser = Depends(require_auth),
) -> Response:
    # Verificar permisos: admin puede exportar cualquier sucursal;
    # jefe solo puede exportar sus sucursales asignadas.
    if not user.is_admin:
        try:
            proposal = await ac.get_proposal(payload.proposal_id)
        except KeyError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

        managers = await ac.list_branch_managers_by_user(user.id)
        authorized_branch_ids = {m.branch_id for m in managers}
        if proposal.branch_id not in authorized_branch_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés acceso a exportar esta sucursal",
            )

    # Cargar y validar datos de exportación
    try:
        dataset = await fetch_export_dataset(payload.proposal_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")
    except ExportError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # Generar xlsx
    xlsx_bytes = export_proposal_to_xlsx(dataset)
    filename = build_filename(dataset)

    # Audit log (fail-silent)
    await ac.create_audit_log(
        user_id=user.id,
        accion="export",
        entidad="proposals",
        entidad_id=payload.proposal_id,
        metadata={
            "filename": filename,
            "filas_exportadas": len({r.worker_id for r in dataset.resolved_assignments}),
        },
    )

    return Response(
        content=xlsx_bytes,
        media_type=_XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )

@router.post("/export/calendar", tags=["export"])
async def export_calendar(payload: CalendarExportRequest) -> Response:
    """Exporta vista de calendario semanal para enviar al jefe de sucursal.
    No requiere autenticación: los datos vienen en el request body."""
    xlsx_bytes = export_calendar_to_xlsx(payload)
    filename   = build_calendar_filename(payload)
    return Response(
        content=xlsx_bytes,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

