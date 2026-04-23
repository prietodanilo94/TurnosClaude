from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="Shift Optimizer API v2",
    version="0.2.0",
    description="Backend de optimización de turnos - Versión 2",
)

_CORS_ORIGINS = [
    "http://localhost:3011",
    "https://turnos2.dpmake.cl",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api", tags=["optimizer"])

@app.get("/health", tags=["infra"])
async def health():
    return {"status": "ok", "version": "v2"}
