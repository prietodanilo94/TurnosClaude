# Tasks — Spec 009

- [ ] **Task 1**: Extender `OptimizeRequest` pydantic con campos opcionales `partial_range`, `assignments_fijas`, `workers_excluidos`.

- [ ] **Task 2**: `optimizer/partial.py` con función `setup_partial_problem(payload)` que prepara el contexto.

- [ ] **Task 3**: Modificar `ilp.py` para aceptar assignments fijas como constraints `x[w,d,s] == 1` sobre ellas.

- [ ] **Task 4**: Modificar `greedy.py` similar: pre-inicializar contadores y saltar días fuera del rango.

- [ ] **Task 5**: Endpoint `/optimize/partial`. Tests con fixtures.

- [ ] **Task 6**: Caso infactible por restricción fija: test que verifica que devuelve 422 con mensaje claro.

- [ ] **Task 7**: `PartialRecalculateDialog` en frontend: selector de rango + checkboxes de trabajadores + modo.

- [ ] **Task 8**: `build-partial-payload.ts`: toma la propuesta activa, filtra assignments dentro del rango (son las que "se tiran"), envía las de fuera como `assignments_fijas`.

- [ ] **Task 9**: Vista de "revisar recálculo" en el calendario con diff visual (colorear días modificados).

- [ ] **Task 10**: Botones "Aprobar" y "Descartar". Al aprobar, reemplaza las assignments del rango en la propuesta y persiste.

- [ ] **Task 11**: Log en `audit_log` con metadata `{rango, workers_excluidos, n_changes}`.

- [ ] **Task 12**: Test E2E: generar propuesta base → recalcular parcialmente 10-15 de mayo excluyendo 1 trabajador → aprobar → verificar que fuera del rango nada cambió.

## DoD

- [ ] Se puede recalcular un rango específico.
- [ ] Los días fuera del rango no se modifican.
- [ ] Las restricciones semanales se respetan considerando horas fijas.
- [ ] Hay auditoría.
