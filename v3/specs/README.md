# Specs v3

Estas specs definen el orden sugerido de construcción de `v3`.

La estrategia elegida es `optimizer-first`: primero validar el problema central de generación con una página de laboratorio controlada, y después expandir a importación, clasificación, calendario completo y exportación.

## Orden sugerido

1. `001-optimizer-playground`
2. `002-auth-and-roles`
3. `003-branch-import-and-classification`
4. `004-shift-catalog-and-patterns`
5. `005-template-generation-engine`
6. `006-sunday-solver-engine`
7. `007-calendar-ui-and-slot-assignment`
8. `008-overrides-and-save`
9. `009-export`

La `001` no reemplaza el producto final. Sirve para validar temprano:

- comportamiento del solver
- sensibilidad a la dotación
- factibilidad real en sucursales dominicales
- diagnóstico de insuficiencia

Así reducimos riesgo antes de construir toda la superficie del sistema.
