# Indice de Specs - Shift Optimizer v2

Cada spec es una feature independiente con su `spec.md` (que),
`tasks.md` (pasos concretos) y `plan.md` (como, se escribe al implementar).

| # | Carpeta | Feature | Dependencias |
|---|---------|---------|-------------|
| 001 | `001-area-catalog/` | Catalogo de 63 areas + mapeo automatico de clasificacion | - |
| 002 | `002-excel-ingestion/` | Upload Excel con columna `Area de Negocio` + lookup auto | 001 |
| 003 | `003-shift-catalog/` | Catalogo de turnos v2 (por clasificacion x area de negocio) | 001 |
| 004 | `004-optimizer/` | Backend FastAPI + ILP adaptado (Mall 7d con 3 turnos) | 001, 003 |
| 005 | `005-calendar-ui/` | Calendario mensual (reutiliza v1, adaptado a turnos v2) | 004 |
| 006 | `006-auth/` | Login y roles (identico a v1, adaptado a nueva DB) | 001 |
| 007 | `007-overrides/` | Overrides post-calculo (cambiar turno/dia por trabajador) | 004, 005 |
| 008 | `008-branch-edit/` | Boton para corregir clasificacion de sucursal | 001, 002 |
| 009 | `009-export-excel/` | Exportacion Excel adaptada a turnos v2 | 004, 005 |
| 010 | `010-factibilidad-analyzer/` | Laboratorio visual de factibilidad para Mall 7 dias | 005 |

## Como leer cada spec

1. **`spec.md`** - Que hay que hacer y por que. Es el contrato de la feature.
2. **`tasks.md`** - Lista ordenada de tareas. Cada tarea = un commit.
3. **`plan.md`** - Como se implementa (se escribe antes de codear, no antes).

## Regla de oro

La spec es la fuente de verdad. Si hay contradiccion entre spec y codigo, el codigo esta mal.
Si hay contradiccion entre dos specs, deten el trabajo y reportalo al usuario antes de continuar.
