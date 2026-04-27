# Tasks - Spec 010

## Slice 1 - Base entregada

- [x] **Task 1**: Crear ruta `/admin/factibilidad` y enlazarla desde el menu admin.
- [x] **Task 2**: Modelar tipos y datasets base para escenarios `N=4..12`.
- [x] **Task 3**: Implementar motor `analyzeFactibilityOption()` separado de la UI.
- [x] **Task 4**: Mostrar 2 opciones por dotacion: fijo y rotativo.
- [x] **Task 5**: Permitir mover libres por clic, semana a semana, sin persistencia.
- [x] **Task 6**: Mostrar cobertura diaria, domingos trabajados y racha maxima.
- [x] **Task 7**: Corregir `local-validator.ts` para medir consecutivos por racha real.
- [x] **Task 8**: Agregar tests unitarios del analizador.
- [x] **Task 9**: Verificar `npm run build` en `v2/frontend`.

## Slice 2 - Continuidad recomendada

- [ ] **Task 10**: Agregar comparacion explicita entre "propuesta base" y "escenario editado" con diff visual.
- [ ] **Task 11**: Incorporar modo "mes real" parametrizable por `anio/mes` para ver efecto de 5 domingos.
- [ ] **Task 12**: Permitir bloquear domingos o marcar preferencias del equipo para comparar justicia del patron.
- [ ] **Task 13**: Diseñar y formalizar una opcion `Mixto (COM + APE/CIE)` con regla de 42h cerrada.
- [ ] **Task 14**: Guardar escenarios locales o persistidos para no perder comparaciones.
- [ ] **Task 15**: Conectar el laboratorio con una sucursal real o con resultados del optimizer lab.
- [ ] **Task 16**: Agregar tests de escenarios editados que rompan consecutivos por cruce entre semanas.

## DoD

- [ ] El usuario puede usar la vista para comparar opciones de dotacion sin leer documentos aparte.
- [ ] Un cambio riesgoso de libre se detecta visualmente en menos de 1 segundo.
- [ ] La herramienta explica por que una opcion se rompe, no solo que se rompe.
- [ ] La spec siguiente para esquema mixto no contradice esta spec.
