# Índice de Specs

Cada spec es una feature independiente con su `spec.md` (qué hay que hacer), `plan.md` (cómo) y `tasks.md` (los pasos concretos).

| #    | Carpeta                   | Feature                               | Dependencias        |
|------|---------------------------|---------------------------------------|---------------------|
| 001  | `001-data-model/`         | Modelo de datos Appwrite + tipos TS/Py | —                  |
| 002  | `002-excel-ingestion/`    | Upload y sincronización del Excel      | 001                |
| 003  | `003-optimizer/`          | Backend FastAPI + ILP + Greedy         | 001, 008           |
| 004  | `004-calendar-ui/`        | Calendario mensual con drag & drop     | 003                |
| 005  | `005-auth-permissions/`   | Login y roles (admin / jefe)           | 001                |
| 006  | `006-exceptions/`         | Excepciones por trabajador             | 001, 003           |
| 007  | `007-export-excel/`       | Exportación a Excel                    | 001, 003, 004      |
| 008  | `008-holidays/`           | Feriados irrenunciables                | 001                |
| 009  | `009-recalculate-partial/`| Recálculo por rango de fechas          | 003, 004           |
| 010  | `010-multiple-proposals/` | Propuestas múltiples + selección jefe  | 003, 004, 005      |

## Orden sugerido de implementación

Ver `docs/claude-code-guide.md` sección "Orden recomendado de implementación".

## Cómo leer cada spec

1. **`spec.md`** — Qué hay que hacer y por qué. Define el "contrato" de la feature.
2. **`plan.md`** — Cómo se hace: archivos, librerías, decisiones técnicas.
3. **`tasks.md`** — Lista ordenada de tareas pequeñas. Cada tarea es un commit.

## Cómo iterar sobre una spec

Si al implementar descubres que algo está mal:

1. Para la implementación.
2. Vuelve a este chat con Claude (o edita la spec directamente).
3. Una vez actualizada la spec, avisa a Claude Code: "la spec NNN cambió, actualiza tu plan y sigue."

La spec es la fuente de verdad. El código la sigue, no al revés.
