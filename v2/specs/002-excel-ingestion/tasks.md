# Tasks — Spec 002: Excel Ingestion v2

## Estado: 🔲 Pendiente

---

- [ ] **Task 1: Bootstrap Appwrite Collections**
  - Agregar `bootstrapBranches()`, `bootstrapWorkers()`, `bootstrapAuditLog()` a `v2/scripts/bootstrap-appwrite-v2.ts`.
  - Atributos a asegurar: `area_negocio` y `rotation_group` en workers; `clasificacion` en branches.
  - Ejecutar `npm run bootstrap:appwrite`.

- [ ] **Task 2: Tipos y Utilidades Base**
  - Actualizar `v2/frontend/src/types/models.ts` con definiciones exactas de Branch, Worker y SyncReport.
  - Copiar `rut-utils.ts` y sus test si aplican.

- [ ] **Task 3: Parser de Excel**
  - Implementar `excel-parser.ts` en v2 sumando detección y parseo de columna "Área de Negocio".

- [ ] **Task 4: Sincronización y Diff Lógico**
  - Implementar `compute-diff.ts` con integración a `lookupArea` para auto-clasificar.
  - Implementar `sync-dotacion.ts` para enviar datos a Appwrite calculando el `rotation_group`.

- [ ] **Task 5: Interfaces y Pantallas UI**
  - Crear la página de `/admin/dotacion`.
  - Crear e integrar componentes: `ExcelUploader`, `DiffPreviewTable`, y `BranchClassifierModal` para resolver faltantes en catálogo.

- [ ] **Task 6: Tests y Verificación**
  - Verificar subida de excel completa.
  - Test E2E u hoja manual de la lectura del Excel.
