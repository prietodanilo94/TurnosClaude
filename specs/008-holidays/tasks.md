# Tasks — Spec 008

- [ ] **Task 1**: `lib/holidays/api.ts` con `listHolidays({year?, month?})`, `createHoliday`, `deleteHoliday`.

- [ ] **Task 2**: `/admin/feriados/page.tsx` con listado agrupado por año.

- [ ] **Task 3**: `NewHolidayDialog` con campos: fecha, nombre, tipo (fixed a `irrenunciable` por ahora). Validación: fecha no duplicada.

- [ ] **Task 4**: `lib/holidays/is-holiday.ts`: función pura `isHoliday(date, holidays): boolean`. Test.

- [ ] **Task 5**: Integrar en `build-payload.ts`: al armar payload, incluir `holidays` filtrados por el mes objetivo.

- [ ] **Task 6**: En `DayCell` (Spec 004), agregar lógica de badge de feriado y bloqueo de drop.

- [ ] **Task 7**: Backend: verificar que `holidays` del payload se respetan en `calendar.is_day_open(d)`.

- [ ] **Task 8**: Test de integración: feriado 1 de mayo, correr optimizador, verificar que ningún trabajador tiene turno ese día.

## DoD

- [ ] CRUD de feriados funciona.
- [ ] Optimizador y calendario respetan feriados.
- [ ] Test de integración pasa.
