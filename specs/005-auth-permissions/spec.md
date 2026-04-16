# Spec 005 — Autenticación y Permisos

## Contexto

El sistema tiene dos roles: **admin** y **jefe_sucursal**. Appwrite maneja el auth (email + password) y los permisos se enforzan a nivel de colección con labels y a nivel de aplicación con middleware.

## Objetivo

1. Login / logout via Appwrite Auth.
2. Middleware de Next.js que protege rutas según rol.
3. Admin panel para crear, editar y desactivar jefes de sucursal (Opción A: password manual).
4. Asignación de sucursales a jefes (relación N:N via `branch_managers`).
5. Un jefe ve SOLO las sucursales asignadas.
6. Gate en backend: FastAPI valida el JWT de Appwrite en cada request a `/optimize` y `/validate`.

## Flujos

### Login

```
/login
  → email + password
  → Appwrite Auth
  → crea sesión + JWT en cookie httpOnly
  → redirige según rol:
      admin → /admin
      jefe_sucursal → /jefe
```

### Creación de jefe (admin)

```
/admin/usuarios/nuevo
  Form:
    - email (único)
    - nombre completo
    - rut (opcional)
    - password temporal (se le comunica al jefe offline)
    - sucursales asignadas (multi-select)
  Submit:
    1. appwrite.users.create(email, password, name)
    2. databases.createDocument("users", { $id: user.$id, email, nombre_completo, rut, rol: "jefe_sucursal", activo: true })
    3. Por cada sucursal: createDocument("branch_managers", { user_id, branch_id, asignado_desde: now(), asignado_hasta: null })
    4. Agregar label "jefe_sucursal" al user en Appwrite Auth
    5. audit_log
```

### Edición de sucursales de un jefe

```
/admin/usuarios/[id]/sucursales
  Muestra asignaciones actuales (asignado_hasta = null).
  Admin agrega/quita:
    - Quitar: update(branch_manager, { asignado_hasta: now() })
    - Agregar: create(branch_manager, { user_id, branch_id, asignado_desde: now(), asignado_hasta: null })
```

### Desactivación

```
/admin/usuarios/[id]  → botón "Desactivar"
  1. update(users/{id}, { activo: false })
  2. update(appwrite.users.$id, status=disabled) vía SDK
  3. Todas sus branch_managers vigentes → asignado_hasta = now()
```

## Middleware

### Frontend (Next.js)

`frontend/src/middleware.ts`:

```ts
// - Redirige /admin/* a /login si no hay sesión
// - Redirige /admin/* a /jefe si sesión pero rol != admin
// - Idem para /jefe/* si rol != jefe_sucursal
```

### Backend (FastAPI)

`backend/app/api/deps.py`:

```python
async def require_auth(request: Request) -> CurrentUser:
    # 1. Leer header Authorization: Bearer <jwt>
    # 2. Validar JWT contra Appwrite API
    # 3. Retornar CurrentUser {id, rol, branches_autorizadas}
```

Aplicado como dependency en `/optimize` y `/validate`.

## Permisos a nivel de Appwrite (en colecciones)

Configurados vía `bootstrap-appwrite.ts` con `Role.label("admin")`, `Role.label("jefe_sucursal")`, `Role.user(userId)`.

Ejemplos:
- `users`:
  - Read: `label:admin` + `user:self`
  - Write: `label:admin`
- `workers`:
  - Read: `label:admin` + custom query filter client-side para jefes
  - Write: `label:admin`
- `assignments`:
  - Read: `label:admin` + `label:jefe_sucursal` (y filtramos por branch a nivel de query)
  - Write: idem

Para el control de jefes solo de SUS branches no hay un mecanismo declarativo perfecto en Appwrite; complementamos con queries filtradas en el cliente + backend. Si el jefe intenta acceder a otra branch, el backend devuelve 403.

## Criterios de aceptación

- [ ] Un admin puede crear un jefe y asignarle 3 sucursales.
- [ ] El jefe se loguea y en su home ve solo esas 3 sucursales.
- [ ] Si el jefe navega manualmente a una URL de otra sucursal (ej: `/jefe/sucursales/xxx`), obtiene 403.
- [ ] El admin puede mover un jefe de sucursal (agregar una, quitar otra) y queda historial.
- [ ] Un jefe desactivado no puede loguearse.
- [ ] El backend rechaza requests sin JWT válido con 401.
