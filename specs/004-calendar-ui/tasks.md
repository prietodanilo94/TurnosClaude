# Tasks — Spec 004

- [ ] **Task 1**: Instalar `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@dnd-kit/core`, `@dnd-kit/sortable`, `zustand`.

- [ ] **Task 2**: `store/calendar-store.ts` con Zustand. Shape completo (branchId, month, proposal, assignments, workers, violations, dirty). Actions stubbed.

- [ ] **Task 3**: `lib/calendar/hours-calculator.ts`: función pura que recibe `assignments` y `shift_catalog` y devuelve `{[workerId]: {[weekNumber]: horas}}`. Tests unitarios.

- [ ] **Task 4**: `lib/calendar/local-validator.ts`: implementa las mismas 8 validaciones del backend, client-side. Tests que reflejan los del backend.

- [ ] **Task 5**: `lib/calendar/overlap-detector.ts`: detecta solapamientos horarios en un mismo día entre slots. Tests.

- [ ] **Task 6**: Ruta `/admin/sucursales/[branchId]/mes/[year]/[month]/page.tsx`. Fetch de la propuesta activa desde Appwrite (o primera generada). Muestra esqueleto con mock data.

- [ ] **Task 7**: `CalendarView` + `MonthGrid` + `WeekRow` + `DayCell` con layout semanal. Renderiza slots estáticos (sin drag).

- [ ] **Task 8**: `ShiftSlot` con visual según color del trabajador. Asignación de colores estable desde utility.

- [ ] **Task 9**: `WeekHoursSummary` al costado de cada semana. Colores según estado (verde/amarillo/rojo).

- [ ] **Task 10**: Integrar `dnd-kit` para arrastre entre `DayCell`s. Al drop, actualiza store, dispara `recompute`, rerenderiza con nuevas violaciones.

- [ ] **Task 11**: `WorkerAssignDialog` (click en slot genérico "Trabajador N" → abre dialog con lista filtrada de trabajadores de la sucursal). Asignación actualiza store.

- [ ] **Task 12**: Badges visuales en slots con violaciones (rojo) + tooltip con texto de `Violation.detalle`.

- [ ] **Task 13**: `ProposalSelector`: dropdown que permite cambiar entre propuestas generadas. Al cambiar, carga la nueva en el store.

- [ ] **Task 14**: Botón "Guardar": persiste `assignments` actualizados en Appwrite (colección `assignments`). Llama a `POST /validate` primero como safety check.

- [ ] **Task 15**: Botón "Exportar Excel" (deshabilitado si `violations.length > 0`). Link hacia la ruta de la Spec 007.

- [ ] **Task 16**: Tests E2E con Playwright del flujo completo: cargar propuesta → arrastrar un slot → ver violación → corregir → guardar.

## DoD

- [ ] Se puede abrir el calendario para cualquier sucursal con propuesta generada.
- [ ] Las 3 operaciones funcionan: mover turno, asignar trabajador, cambiar propuesta.
- [ ] Las violaciones aparecen en menos de 100 ms tras una acción.
- [ ] Los tests E2E pasan.
