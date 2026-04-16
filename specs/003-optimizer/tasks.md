# Tasks — Spec 003

## Fase A

- [ ] **Task 1**: Crear estructura de `backend/` con `app/main.py` mínimo exponiendo `/health`. Dockerfile que construye y corre. `docker compose up optimizer` levanta el servicio en puerto 8000.

- [ ] **Task 2**: Pydantic models en `app/models/schemas.py` completos (OptimizeRequest, OptimizeResponse, Proposal, Assignment, Diagnostico, Constraint, ShiftDef, etc.). Validar con un payload de ejemplo.

- [ ] **Task 3**: Stubs de `/optimize` y `/validate` retornando 501 con mensaje "Not implemented yet". OpenAPI docs visibles en `/docs`.

## Fase B

- [ ] **Task 4**: `core/calendar.py`: funciones para generar los días de un mes, semanas ISO, identificar domingos, etc. Con tests.

- [ ] **Task 5**: `optimizer/greedy.py`: implementación completa siguiendo `math-formulation.md` §7.

- [ ] **Task 6**: Wire greedy a `/optimize`. Fixture `standalone_basic.json` y test que verifica que devuelve una solución factible.

## Fase C

- [ ] **Task 7**: `optimizer/lower_bound.py` con la fórmula. Test con casos conocidos.

- [ ] **Task 8**: Endpoint devuelve `diagnostico.dotacion_minima_requerida` siempre, incluso en errores.

- [ ] **Task 9**: Manejo del 409 "dotación insuficiente" antes de correr solver.

## Fase D

- [ ] **Task 10**: `core/validators.py` con función `validar_solucion(solucion, payload) -> list[Violacion]`. Implementa las 8 validaciones.

- [ ] **Task 11**: Un test por cada tipo de violación. Forzamos el escenario y verificamos que el validator lo atrapa.

- [ ] **Task 12**: `/validate` operativo.

## Fase E

- [ ] **Task 13**: `optimizer/objective.py` con builders de cada término ($Z_{cobertura}$, $Z_{finde}$, $Z_{balance}$, $Z_{ociosidad}$). Tests unitarios.

- [ ] **Task 14**: `optimizer/ilp.py` con modelo CP-SAT completo: variables, todas las constraints de §3, objetivo combinado. Solver con time limit. Extrae solución a formato interno.

- [ ] **Task 15**: Wire ILP a `/optimize` cuando `modo == "ilp"`. Fixture + test de solución óptima conocida (caso chico 3 trabajadores, 7 días).

- [ ] **Task 16**: Múltiples propuestas vía perturbación de pesos (Opción B). Parámetro `num_propuestas` controla cuántas retorna. Test que verifica que retorna N propuestas distintas.

## Fase F

- [ ] **Task 17**: Benchmark manual con casos reales (tu Excel de ejemplo expandido a 20-30 trabajadores). Documentar tiempos en `docs/benchmarks.md`.

- [ ] **Task 18**: Ajustar pesos default según benchmark. Dejar comentarios explicando cada elección.

- [ ] **Task 19**: Manejo de timeouts y errores amigables. 422 cuando el solver no encuentra solución factible.

- [ ] **Task 20**: Agregar ejemplos en OpenAPI docs (request y response completos).

## DoD

- [ ] `docker compose up` levanta el optimizer y responde `/health`.
- [ ] Los 3 modos (`ilp`, `greedy`, validación) funcionan end-to-end con fixtures.
- [ ] Cobertura de tests > 80%.
- [ ] Benchmarks documentados.
- [ ] La API está totalmente documentada en `/docs` con ejemplos reales.
