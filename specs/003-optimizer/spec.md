# Spec 003 — Optimizador (Backend Python)

## Contexto

Servicio FastAPI que resuelve el problema de asignación de turnos. Expone dos modos:
- **ILP** (OR-Tools CP-SAT): óptimo global.
- **Greedy**: heurística constructiva rápida.

Y devuelve N propuestas comparables.

> La formulación matemática completa está en `docs/math-formulation.md`. Esta spec define el contrato de API y la estructura del servicio.

## Objetivo

1. Endpoint `POST /optimize` que recibe el payload (dotación, restricciones, franja, parámetros) y devuelve propuestas.
2. Endpoint `POST /validate` que verifica si una solución dada cumple todas las restricciones.
3. Endpoint `GET /health` para probes.
4. Tests unitarios del solver con fixtures JSON que representen cada regla.
5. Tests de regresión contra un dataset canónico (ej: Standalone 5 trabajadores, mes conocido).

## Endpoints

### `POST /optimize`

**Request**: ver `docs/architecture.md` sección "Endpoint único crítico".

**Response** (ver architecture.md también):
```json
{
  "propuestas": [...],
  "diagnostico": {
    "dotacion_disponible": N,
    "dotacion_minima_requerida": M,
    "dotacion_suficiente": bool,
    "mensajes": ["..."]
  }
}
```

**Errores bien definidos**:
- `400`: payload inválido (schema).
- `409`: dotación insuficiente (no corremos el ILP).
- `422`: problema sin solución factible con las restricciones dadas. Retornamos qué restricción es probablemente la causa.
- `504`: time-out del solver (> `time_limit_seconds`).

### `POST /validate`

Recibe un payload idéntico al de `/optimize` + un array de `asignaciones`. Retorna:

```json
{
  "valido": true,
  "violaciones": [
    {
      "tipo": "horas_semanales_excedidas",
      "worker_rut": "...",
      "detalle": "Semana 2: 44h > 42h"
    }
  ]
}
```

Útil para:
- Validar en el backend lo que el optimizador propone (defensa en profundidad).
- Validar las ediciones manuales del admin antes de guardar.

### `GET /health`

Simple, retorna `{"status": "ok", "ortools_version": "..."}`.

## Estructura del servicio

```
backend/
├── app/
│   ├── main.py                    ← FastAPI app
│   ├── api/
│   │   ├── routes.py              ← Definición de rutas
│   │   └── deps.py                ← Dependencias (validación JWT si activamos)
│   ├── models/
│   │   ├── schemas.py             ← Pydantic request/response
│   │   └── domain.py              ← Dataclasses internos del solver
│   ├── core/
│   │   ├── calendar.py            ← Generación de días del mes, semanas ISO
│   │   ├── validators.py          ← Validador de soluciones
│   │   └── config.py              ← Lectura de env vars
│   ├── optimizer/
│   │   ├── __init__.py
│   │   ├── ilp.py                 ← Solver ILP con OR-Tools CP-SAT
│   │   ├── greedy.py              ← Solver heurístico
│   │   ├── lower_bound.py         ← Cálculo de dotación mínima
│   │   ├── scoring.py             ← Cálculo de score de una solución
│   │   └── objective.py           ← Construcción de la función objetivo
│   └── utils/
│       └── holidays.py
├── tests/
│   ├── fixtures/
│   │   ├── standalone_basic.json
│   │   ├── movicenter_full.json
│   │   └── infeasible_short_staff.json
│   ├── test_ilp.py
│   ├── test_greedy.py
│   ├── test_validator.py
│   └── test_lower_bound.py
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

## Requisitos técnicos

- Python 3.11+.
- OR-Tools 9.10+.
- FastAPI 0.110+.
- Uvicorn.
- Pydantic v2.
- Pytest.
- Tiempo de respuesta objetivo:
  - Greedy: < 1 s incluso con 30 trabajadores y 31 días.
  - ILP: < 30 s para el 95% de los casos reales (con `time_limit_seconds = 30`).

## Criterios de aceptación

- [ ] Los 3 endpoints están documentados via OpenAPI (FastAPI lo hace automático).
- [ ] Fixture `standalone_basic` se resuelve en ILP y greedy devolviendo soluciones factibles.
- [ ] Fixture `infeasible_short_staff` devuelve `409` con mensaje explicativo.
- [ ] El validator atrapa TODAS las violaciones listadas en `docs/math-formulation.md` sección 8.
- [ ] Cobertura de tests > 80%.
- [ ] El servicio arranca en Docker con `docker compose up`.
