# Plan — Spec 004

## Archivos

```
frontend/src/
├── app/
│   ├── admin/sucursales/[branchId]/mes/[year]/[month]/
│   │   └── page.tsx                          ← Vista del calendario
│   └── jefe/sucursales/[branchId]/mes/[year]/[month]/
│       └── page.tsx                          ← Misma vista con permisos restringidos
├── features/calendar/
│   ├── CalendarView.tsx                      ← Contenedor principal
│   ├── MonthGrid.tsx                         ← La grilla mensual
│   ├── WeekRow.tsx                           ← Una fila de semana
│   ├── DayCell.tsx                           ← Celda de un día
│   ├── ShiftSlot.tsx                         ← Slot individual (arrastrable)
│   ├── WeekHoursSummary.tsx                  ← Contador lateral
│   ├── ProposalSelector.tsx                  ← Dropdown de propuestas
│   ├── WorkerAssignDialog.tsx                ← Dialog para asignar trabajador a slot
│   └── LiveValidationBadges.tsx
├── store/calendar-store.ts                   ← Zustand
├── lib/calendar/
│   ├── hours-calculator.ts                   ← Cálculo horas por trabajador/semana
│   ├── overlap-detector.ts                   ← Detección visual de solapes
│   └── local-validator.ts                    ← Validación rápida client-side
```

## Estado (Zustand)

```ts
interface CalendarState {
  branchId: string
  month: { year: number; month: number }
  proposal: Proposal  // propuesta activa
  assignments: Assignment[]  // slot → worker
  workers: Worker[]
  violations: Violation[]
  dirty: boolean

  // actions
  moveSlot(slotId, toDate): void
  assignWorker(slotId, workerId): void
  recompute(): void  // recalcula hours + violations
  save(): Promise<void>
  setProposal(newProposal): void
}
```

## Lógica de validación client-side

Espejo de `backend/app/core/validators.py`. Compartida como utilidad en `frontend/src/lib/calendar/local-validator.ts`.

Cada cambio → dispara `recompute()` que:
1. Recalcula horas/semana/trabajador.
2. Corre validaciones locales.
3. Actualiza `violations[]`.
4. Los componentes se re-renderizan con badges actualizados.

Al guardar → también se llama a `POST /validate` en el backend como verificación final.

## Drag & drop

Usaremos **dnd-kit** por sobre FullCalendar's built-in porque queremos:
- Arrastrar slots entre días.
- Mostrar overlay mientras se arrastra.
- Cancelar si la operación viola una restricción dura (bloqueamos el drop).

## Tema visual

- Colores por trabajador: paleta estable (los primeros N trabajadores toman colores preasignados; se genera hash para los extras). Los colores deben tener contraste suficiente para el texto.
- Modo oscuro opcional (para jefes que trabajan de noche, según su "shadcn theme").

## Performance

- Si el mes tiene 31 días × 10 trabajadores × 1 turno = 310 slots. Es manejable sin virtualización.
- Memoizar componentes de `DayCell` y `ShiftSlot` con `React.memo` + selectors finos de Zustand para evitar rerenders globales.
