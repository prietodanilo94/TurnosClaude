# Plan — Spec 009

## Archivos

```
backend/app/
├── api/routes.py                       ← + endpoint /optimize/partial
└── optimizer/partial.py                ← wrapper que fija assignments base y resuelve solo el rango

frontend/src/
├── features/calendar/
│   └── PartialRecalculateDialog.tsx
└── lib/optimizer/
    └── build-partial-payload.ts
```

## Endpoint

`POST /optimize/partial`

Request: idéntico a `/optimize` + campos extra:
```json
{
  "partial_range": { "desde": "2026-05-15", "hasta": "2026-05-30" },
  "assignments_fijas": [
    { "worker_rut": "...", "date": "2026-05-02", "shift_id": "S_10_20" },
    ...
  ],
  "workers_excluidos": ["16659860-5"]
}
```

Response: mismo shape que `/optimize` pero las propuestas solo contienen `asignaciones` del rango.

## Modificaciones al solver ILP

En `ilp.py`, cuando se llama con `partial_range`:
1. Fijar $x_{w,d,s} = v$ para $(w,d,s)$ donde $d$ está fuera del rango, según `assignments_fijas`.
2. Eliminar del conjunto $W$ a los `workers_excluidos` (para los días del rango; pero si tienen asignaciones fijas fuera, esas se mantienen).
3. Las restricciones semanales 3.6 y 3.7 usan el conjunto completo de días (dentro y fuera del rango), con las variables fijas contribuyendo a la suma.
4. Objetivo: se aplica solo sobre los días del rango.

## Modificaciones al solver Greedy

Más directo: ordenar solo los días del rango y aplicar el algoritmo habitual, con los contadores `horas_semana` inicializados según las assignments fijas.

## UI

- `PartialRecalculateDialog` reutiliza `WorkerPicker` con checkboxes (todos marcados por default, el admin desmarca los excluidos).
- El calendario entra en modo "revisar recálculo" antes de persistir, con diff visual.

## Riesgos

- Si las restricciones fijas dejan el subproblema infactible (ej: un trabajador ya tiene 35h en la semana y con el rango nuevo se pasa a 45h), el solver retorna 422 con detalle. La UI muestra qué restricción explotó.
