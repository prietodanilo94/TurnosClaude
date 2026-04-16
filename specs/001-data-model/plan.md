# Plan de Implementación — Spec 001

## Enfoque

Implementamos el modelo de datos como código. El "source of truth" es el script de bootstrap en TypeScript que usa el Appwrite Node SDK. Desde él derivamos los tipos del frontend y los modelos Pydantic del backend.

## Orden de ejecución

1. Crear estructura base del proyecto (si no existe).
2. Escribir `scripts/bootstrap-appwrite.ts`.
3. Ejecutar contra Appwrite dev y verificar.
4. Generar tipos TypeScript (`frontend/src/types/models.ts`).
5. Generar modelos Pydantic (`backend/app/models/schemas.py`).
6. Cargar seeds: `shift_catalog`, `branch_type_config`, `holidays`.
7. Crear primer admin por CLI.

## Archivos a crear/modificar

```
shift-optimizer/
├── scripts/
│   ├── bootstrap-appwrite.ts       ← NUEVO (script principal)
│   ├── seed-shift-catalog.ts       ← NUEVO
│   ├── seed-branch-type-config.ts  ← NUEVO
│   ├── seed-holidays.ts            ← NUEVO (2026, 2027)
│   └── create-first-admin.ts       ← NUEVO
├── frontend/
│   └── src/types/models.ts         ← NUEVO
├── backend/
│   └── app/models/schemas.py       ← NUEVO
├── package.json                    ← MODIFICAR (scripts npm)
└── .env.example                    ← NUEVO
```

## Dependencias npm (raíz del monorepo o en scripts/)

```json
{
  "dependencies": {
    "node-appwrite": "^14.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.15.0",
    "@types/node": "^20.0.0",
    "dotenv": "^16.4.0"
  }
}
```

## Convenciones

- **Idempotencia**: cada función del bootstrap primero consulta si la colección/atributo existe antes de crearlo.
- **Naming**: snake_case para IDs y atributos de Appwrite; camelCase para tipos TS; snake_case para Pydantic.
- **Logs**: cada paso del bootstrap imprime `✓ creada X` o `↷ X ya existía, skip`.
- **Errores**: abortamos en cualquier error no esperado; no silenciamos.

## Seeds iniciales

### `shift_catalog`

```
S_10_20  — "10:00 a 20:00" — 600 min — descuenta colación — principal
S_11_20  — "11:00 a 20:00" — 540 min — descuenta colación — principal
S_10_19  — "10:00 a 19:00" — 540 min — descuenta colación — principal
S_1030_2030 — "10:30 a 20:30" — 600 min — descuenta colación — principal
S_1030_21 — "10:30 a 21:00" — 630 min — descuenta colación — principal
S_09_19 — "09:00 a 19:00" — 600 min — descuenta colación — principal
S_10_14 — "10:00 a 14:00" — 240 min — no descuenta — principal
S_13_20 — "13:00 a 20:00" — 420 min — no descuenta — adicional
S_10_17 — "10:00 a 17:00" — 420 min — no descuenta — adicional
S_12_20 — "12:00 a 20:00" — 480 min — no descuenta — adicional
```

### `branch_type_config`

**standalone**:
- L-V 09:00-19:00, Sábado 10:00-14:00, Domingo cerrado.
- Shifts aplicables: S_09_19, S_10_14, S_12_20, S_13_20, S_10_17.

**autopark**:
- L-S 09:00-19:00, Domingo cerrado.
- Shifts: S_09_19, S_10_19, S_13_20, S_10_17, S_12_20.

**movicenter**:
- L-D 10:00-20:00.
- Shifts: S_10_20, S_11_20, S_10_19, S_13_20, S_10_17, S_12_20.

**tqaoev**:
- L-S 10:00-20:00, Domingo 11:00-20:00.
- Shifts: S_10_20, S_11_20, S_10_19, S_13_20, S_10_17, S_12_20.

**sur**:
- L-J 10:30-20:30, V 10:30-21:00, S 10:30-20:30, D 11:00-20:00.
- Shifts: S_1030_2030, S_1030_21, S_11_20, S_13_20, S_10_17, S_12_20.

### `holidays` 2026

- 2026-01-01 — Año Nuevo
- 2026-05-01 — Día del Trabajador
- 2026-09-18 — Fiestas Patrias
- 2026-12-25 — Navidad
- Elecciones presidenciales 2025/2026: agregar manualmente cuando el gobierno fije fecha.

## Riesgos / notas

- Si Appwrite cambia su API, el bootstrap puede fallar. Fijamos la versión del SDK.
- El primer admin requiere un label `admin`. Lo hacemos vía CLI o Console manualmente si el SDK no expone la API de labels en la versión usada.
