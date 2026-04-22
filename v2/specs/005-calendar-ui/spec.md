# Spec 005 — Calendario UI v2

## Contexto

La UI del calendario es muy similar a v1. Las diferencias son:
1. Los slots muestran el **tipo de turno** (APE / CIE / COM) además del horario.
2. El color de cada slot refleja el tipo de turno, no solo el trabajador.
3. Para Mall 7d, todos los días aparecen (incluido domingo).
4. El menú de override (spec 007) se accede desde cada slot del calendario.

## Reutilización de v1

Se pueden copiar y adaptar los siguientes componentes de `v1/frontend/src/components/calendar/`:
- `MonthGrid.tsx` — estructura de semanas
- `WeekRow.tsx` — fila semanal
- `DayCell.tsx` — celda por día (adaptar para tipo de turno)
- `ShiftSlot.tsx` — slot de turno (adaptar colores)
- `WeekHoursSummary.tsx` — resumen de horas (verificar que funcione con 5d/semana)

## Cambios respecto a v1

### Colores por tipo de turno (en vez de por trabajador)

| Tipo | Color |
|------|-------|
| `apertura` | Azul claro |
| `cierre` | Naranja |
| `completo` | Verde oscuro |
| `opcion_a` | Azul |
| `opcion_b` | Púrpura |
| `sabado` | Gris |
| `unico` | Teal |

> El trabajador asignado se muestra como texto sobre el slot, no como color de fondo.

### Vista domingo para Mall 7d

El `MonthGrid` debe incluir la columna domingo para sucursales `mall_7d`. Para las demás, domingo permanece oculto o marcado como cerrado.

### Indicador de override

Si un slot tiene un override aplicado, mostrar un ícono de advertencia (✏️) en la esquina del slot. Al hacer hover, mostrar el detalle del override.

## Store (Zustand)

Igual que v1 (`calendar-store.ts`) con nuevos campos:
- `rotationGroup: string` — grupo de rotación de la sucursal
- `overrides: Override[]` — lista de overrides activos (spec 007)

## Criterios de aceptación

- [ ] El calendario muestra los 7 días para sucursales V_M7.
- [ ] Los slots se colorean por tipo de turno.
- [ ] El nombre del trabajador (cuando está asignado) aparece sobre el slot.
- [ ] Los overrides muestran el ícono ✏️.
- [ ] El resumen semanal de horas funciona para semanas de 5 días (V_M7).
- [ ] Tests E2E: `calendar-v2.spec.ts` (al menos 3 casos).
