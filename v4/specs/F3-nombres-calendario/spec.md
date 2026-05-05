# F3 — Nombres visibles en calendario

## Problema

Las celdas del calendario muestran el slot (turno) asignado pero no el nombre del vendedor. El admin/supervisor necesita ver de un vistazo quién está en cada slot sin tener que abrir el detalle.

## Comportamiento actual

`CalendarView.tsx` muestra el tipo de slot (ej. "Apertura", "Cierre") o el nombre del primer vendedor según la vista. En vista global la celda no siempre muestra el nombre.

## Comportamiento esperado

### Vista global (todos los vendedores)

- Cada celda muestra: `[slot] — [Nombre]`
- Si hay más de un vendedor en el mismo slot ese día: mostrar ambos nombres (ej. `Apertura — Ana / Luis`).
- Nombre abreviado si es muy largo: primer nombre + inicial apellido.

### Vista individual (por vendedor)

- Ya muestra el slot. Agregar nombre completo del vendedor en el encabezado de fila.

## Impacto en código

| Archivo | Cambio |
|---------|--------|
| `CalendarView.tsx` | Mostrar nombre en celdas de vista global |
| API de calendario | Incluir `workerName` en payload de asignaciones (si no viene ya) |

## Notas

- Verificar si `generator.ts` ya retorna nombre del worker en cada asignación o solo `workerId`.
- Si solo retorna `workerId`, agregar join con `Worker.nombre` en la query.
