# Índice de Specs — Shift Optimizer v2

Cada spec es una feature independiente con su `spec.md` (qué), `tasks.md` (pasos concretos) y `plan.md` (cómo, se escribe al implementar).

| # | Carpeta | Feature | Dependencias |
|---|---------|---------|-------------|
| 001 | `001-area-catalog/` | Catálogo de 63 áreas + mapeo automático clasificación | — |
| 002 | `002-excel-ingestion/` | Upload Excel con columna `Área de Negocio` + lookup auto | 001 |
| 003 | `003-shift-catalog/` | Catálogo de turnos v2 (por clasificación × área de negocio) | 001 |
| 004 | `004-optimizer/` | Backend FastAPI + ILP adaptado (Mall 7d con 3 turnos) | 001, 003 |
| 005 | `005-calendar-ui/` | Calendario mensual (reutiliza v1, adaptado a turnos v2) | 004 |
| 006 | `006-auth/` | Login y roles (idéntico a v1, adaptado a nueva DB) | 001 |
| 007 | `007-overrides/` | Overrides post-cálculo (cambiar turno/día por trabajador) | 004, 005 |
| 008 | `008-branch-edit/` | Botón para corregir clasificación de sucursal | 001, 002 |
| 009 | `009-export-excel/` | Exportación Excel adaptada a turnos v2 | 004, 005 |

## Cómo leer cada spec

1. **`spec.md`** — Qué hay que hacer y por qué. Es el contrato de la feature.
2. **`tasks.md`** — Lista ordenada de tareas. Cada tarea = un commit.
3. **`plan.md`** — Cómo se implementa (se escribe antes de codear, no antes).

## Regla de oro

La spec es la fuente de verdad. Si hay contradicción entre spec y código, el código está mal.
Si hay contradicción entre dos specs, detente y repórtalo al usuario antes de continuar.
