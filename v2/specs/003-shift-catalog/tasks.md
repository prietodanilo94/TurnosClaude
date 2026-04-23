# Tasks — Spec 003: Shift Catalog

## Estado: 🔲 Pendiente

---

- [ ] **Task 1: Definición de Tipos y Modelos**
  - Actualizar `v2/frontend/src/types/models.ts` con la interfaz `ShiftV2`.
  - Actualizar `v2/backend/app/models/schemas.py` con `ShiftInfoV2`.

- [ ] **Task 2: Appwrite Bootstrap**
  - Modificar `v2/scripts/bootstrap-appwrite-v2.ts` para crear la colección `shift_catalog_v2`.
  - Crear los atributos requeridos (rotation_group, nombre_turno, nombre_display, horario_por_dia, descuenta_colacion, dias_aplicables).

- [ ] **Task 3: Script Seeder de Turnos**
  - Crear `v2/scripts/seed-shift-catalog-v2.ts`.
  - Definir la matriz harcodeada de todos los turnos dados en la spec.
  - Implementar lógica idempotente (`db.listDocuments` y comprobación de existencia) para insertar o actualizar documentos usando el `$id` proporcionado.

- [ ] **Task 4: Funciones Helper**
  - Implementar `getShiftsForGroup(rotationGroup: string)` en `v2/frontend/src/lib/shift-catalog.ts` utilizando consultas directas al cliente de Appwrite o un cacheo inicial.
  - Implementar consulta similar si es necesario en `v2/backend/app/services/shift_catalog.py`.

- [ ] **Task 5: Ejecución y Validación**
  - Correr `bootstrap-appwrite-v2.ts`.
  - Correr `seed-shift-catalog-v2.ts` y visualizar los ~26 turnos creados.
