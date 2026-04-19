from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="Shift Optimizer API",
    version="0.1.0",
    description="Backend de optimización de turnos con OR-Tools CP-SAT.",
)

_CORS_ORIGINS = [
    "http://localhost:3000",
    "https://turnos.dpmake.cl",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)


@app.get("/health", tags=["infra"])
async def health():
    try:
        from ortools import __version__ as ortools_version
    except Exception:
        ortools_version = "unavailable"
    return {"status": "ok", "ortools_version": ortools_version}
