# Tasks — Spec 001

Cada tarea es un commit.

- [ ] **Task 1**: Crear estructura base `scripts/`, `frontend/`, `backend/`, `package.json` raíz con `tsx` y `node-appwrite`. Crear `.env.example`. Verificar que `npx tsx scripts/hello.ts` imprime "hola".

- [ ] **Task 2**: Implementar `scripts/bootstrap-appwrite.ts` para las colecciones `users`, `branches`, `branch_type_config`, `shift_catalog`. Debe ser idempotente (check antes de crear). Ejecutar contra Appwrite dev y verificar en la consola.

- [ ] **Task 3**: Extender bootstrap con `workers`, `branch_managers`, `holidays`, `worker_constraints`. Verificar índices únicos y compuestos.

- [ ] **Task 4**: Extender bootstrap con `proposals`, `assignments`, `audit_log`. Revisar que los atributos JSON estén bien declarados (Appwrite los guarda como string serializado; wrapper en código).

- [ ] **Task 5**: Configurar permisos por rol (labels) en cada colección. Probar con un usuario dummy no-admin que no puede leer `users`.

- [ ] **Task 6**: Implementar `seed-shift-catalog.ts` y correrlo. Verificar las 10 entradas.

- [ ] **Task 7**: Implementar `seed-branch-type-config.ts` y correrlo. Verificar 5 entradas.

- [ ] **Task 8**: Implementar `seed-holidays.ts` con 2026 y 2027 (feriados irrenunciables). Dejar función genérica que acepta año como parámetro.

- [ ] **Task 9**: Generar `frontend/src/types/models.ts` con todos los tipos. Verificar que compila con `tsc --noEmit`.

- [ ] **Task 10**: Generar `backend/app/models/schemas.py` con modelos Pydantic correspondientes. Verificar con `python -c "from app.models import schemas"`.

- [ ] **Task 11**: Implementar `create-first-admin.ts`: recibe email, password y nombre por CLI, crea usuario en Auth + documento en `users` + label admin. Correrlo y verificar login desde la consola Appwrite.

- [ ] **Task 12**: Documentar todo el flujo de bootstrap en `docs/appwrite-setup.md` (actualizar el existente). Agregar comandos exactos.

## Definition of Done

- El bootstrap corre limpio desde cero en una Appwrite vacía (< 1 min).
- Los tipos TS y Pydantic existen y compilan.
- Hay un admin que puede loguearse.
- `docs/appwrite-setup.md` refleja el estado real del sistema.
- Todos los commits tienen prefijo `feat(data-model):` o `chore(data-model):`.
