# Tasks — Spec 010

- [ ] **Task 1**: Extender `proposals` en Appwrite con atributos `metrics` (JSON) y `publicada_por`, `publicada_en`. Actualizar bootstrap.

- [ ] **Task 2**: Backend `optimizer/scoring.py`: función `compute_metrics(solution, payload)` que calcula las 6 métricas. Se invoca al generar cada propuesta.

- [ ] **Task 3**: El backend devuelve `metrics` en cada elemento de `propuestas[]`.

- [ ] **Task 4**: Al guardar propuestas en frontend (post-optimize), persistir `metrics` en el doc.

- [ ] **Task 5**: `lib/proposals/state-machine.ts`: funciones puras `canTransition(currentState, action, userRole): boolean`. Tests.

- [ ] **Task 6**: `lib/proposals/api.ts`: funciones `publishProposal`, `selectProposal`, `discardProposal`. Implementa la regla de "solo 1 seleccionada" via transacción (updates en serie con manejo de errores).

- [ ] **Task 7**: `ProposalCard` component con métricas visibles y botones de acción según estado/rol.

- [ ] **Task 8**: `/admin/sucursales/[branchId]/mes/.../propuestas/page.tsx`: grid de las N propuestas con checkboxes de publicación y botón "Publicar seleccionadas".

- [ ] **Task 9**: `/admin/sucursales/.../propuestas/comparar/page.tsx`: selector de 2 propuestas y vista lado-a-lado con calendarios read-only y tabla de métricas.

- [ ] **Task 10**: `/jefe/sucursales/[branchId]/mes/[year]/[month]/seleccionar/page.tsx`: ve solo propuestas publicadas. Cada una con preview y botón "Elegir esta".

- [ ] **Task 11**: Al seleccionar, redirige al calendario principal con la propuesta ya cargada como base.

- [ ] **Task 12**: Test de concurrencia: dos clientes intentando seleccionar simultáneamente → uno tiene éxito, el otro error claro.

- [ ] **Task 13**: Audit log en cada transición de estado.

## DoD

- [ ] Se generan N propuestas con métricas.
- [ ] Admin puede publicar un subset.
- [ ] Jefe ve y puede seleccionar solo publicadas.
- [ ] Comparador funciona.
- [ ] Concurrencia resuelta.
