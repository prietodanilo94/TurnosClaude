from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schemas import OptimizeRequest, ValidateRequest

router = APIRouter()


@router.post("/optimize", tags=["optimizer"])
async def optimize(payload: OptimizeRequest):
    return JSONResponse(status_code=501, content={"detail": "Not implemented yet"})


@router.post("/validate", tags=["optimizer"])
async def validate(payload: ValidateRequest):
    return JSONResponse(status_code=501, content={"detail": "Not implemented yet"})
