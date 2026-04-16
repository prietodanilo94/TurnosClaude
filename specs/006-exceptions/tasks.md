# Tasks — Spec 006

- [ ] **Task 1**: `lib/exceptions/api.ts`: funciones `listExceptionsByWorker`, `createException`, `updateException`, `deleteException`.

- [ ] **Task 2**: `lib/exceptions/validation.ts` con Zod schemas por tipo. Tests.

- [ ] **Task 3**: `/admin/trabajadores/page.tsx`: listado con tabla + buscador por nombre/RUT + filtro por sucursal.

- [ ] **Task 4**: `/admin/trabajadores/[id]/page.tsx`: ficha básica (nombre, RUT, sucursal, supervisor).

- [ ] **Task 5**: `/admin/trabajadores/[id]/excepciones/page.tsx` con `ExceptionsList` mostrando existentes.

- [ ] **Task 6**: `NewExceptionDialog`: formulario adaptativo según tipo seleccionado. Valida y guarda.

- [ ] **Task 7**: Edición y eliminación de excepciones con confirmación.

- [ ] **Task 8**: `lib/exceptions/to-optimizer-constraint.ts` con tests unitarios. Cubre los 4 tipos.

- [ ] **Task 9**: Integrar en `build-payload.ts` el fetch de excepciones y su conversión. Verificar con test que un payload con un trabajador de vacaciones 10-20 mayo incluye `{tipo:"vacaciones", desde:"2026-05-10", hasta:"2026-05-20"}`.

- [ ] **Task 10**: Test de integración: crear excepción, generar propuesta, verificar que no tiene el turno prohibido.

- [ ] **Task 11**: Vista read-only para jefes: ruta `/jefe/trabajadores/[id]/excepciones` muestra lista sin botones de editar.

## DoD

- [ ] CRUD completo funciona.
- [ ] Las excepciones llegan al backend en cada optimización.
- [ ] El optimizador respeta las excepciones (test de integración end-to-end).
