# Tasks — Spec 005

- [ ] **Task 1**: `lib/auth/appwrite-client.ts`: cliente singleton del SDK web. Configura endpoint + projectId desde env.

- [ ] **Task 2**: `/login` con form email+password. Llama a `account.createEmailPasswordSession`. Guarda user en cookie. Redirige según rol.

- [ ] **Task 3**: `lib/auth/use-current-user.ts` hook. Obtiene session + label + documento `users/$id`. Expone `user`, `isAdmin`, `isJefe`, `authorizedBranchIds`.

- [ ] **Task 4**: `middleware.ts`: protege `/admin/*` y `/jefe/*`. Redirige apropiadamente. Permite `/login` siempre.

- [ ] **Task 5**: Layouts `admin/layout.tsx` y `jefe/layout.tsx` con navegación lateral. Muestran email del usuario + logout.

- [ ] **Task 6**: Backend `services/appwrite_jwt.py`: función `validate_jwt(token)` que llama a Appwrite para verificar y devuelve info del usuario.

- [ ] **Task 7**: Backend `api/deps.py`: dependencias `require_auth` y `require_admin`. Aplicadas en `/optimize` y `/validate`. Test que sin JWT da 401.

- [ ] **Task 8**: `/admin/usuarios/page.tsx`: lista de jefes con estado activo/inactivo, cantidad de sucursales asignadas.

- [ ] **Task 9**: `/admin/usuarios/nuevo/page.tsx`: form completo de creación. Validaciones (email, password ≥ 8 caracteres, nombre obligatorio, al menos 1 sucursal).

- [ ] **Task 10**: Función cliente `createJefeSucursal(input)`: ejecuta el flujo completo (auth.create → users.doc → branch_managers → label). Manejo de errores con rollback best-effort si falla a mitad.

- [ ] **Task 11**: `/admin/usuarios/[id]/sucursales/page.tsx`: UI para agregar/quitar sucursales de un jefe. Mantiene historial (no borra, marca `asignado_hasta`).

- [ ] **Task 12**: Botón "Desactivar" en `/admin/usuarios/[id]` que ejecuta la secuencia de desactivación.

- [ ] **Task 13**: En páginas de jefe, todas las queries filtran por `branch_id IN authorizedBranchIds`. Si un jefe accede a URL de otra branch, layout la redirige a `/jefe/403`.

- [ ] **Task 14**: Tests E2E con Playwright: login admin, crear jefe con 2 sucursales, logout, login jefe, ver solo esas 2, intentar URL de otra → 403.

- [ ] **Task 15**: Script `scripts/audit-roles.ts` que verifica consistencia entre labels Appwrite y docs `users`.

## DoD

- [ ] Flujo completo admin-crea-jefe funciona.
- [ ] Jefes no pueden ver sucursales no asignadas.
- [ ] Backend rechaza JWT inválido.
- [ ] Tests E2E pasan.
