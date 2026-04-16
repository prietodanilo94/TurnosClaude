# Plan — Spec 005

## Archivos

```
frontend/src/
├── middleware.ts                         ← Guard de rutas
├── app/
│   ├── login/page.tsx
│   ├── admin/
│   │   ├── layout.tsx                    ← Chequea rol
│   │   └── usuarios/
│   │       ├── page.tsx                  ← Lista jefes
│   │       ├── nuevo/page.tsx            ← Crear jefe
│   │       └── [id]/
│   │           ├── page.tsx              ← Ver/editar datos
│   │           └── sucursales/page.tsx   ← Asignaciones
│   └── jefe/
│       └── layout.tsx                    ← Chequea rol
├── lib/auth/
│   ├── appwrite-client.ts                ← Cliente Appwrite web
│   ├── session.ts                        ← Helpers de sesión
│   └── use-current-user.ts               ← Hook de React
└── lib/permissions/
    └── branch-authz.ts                   ← Función isBranchAuthorized(user, branchId)

backend/app/
├── api/deps.py                           ← require_auth, require_admin
└── services/appwrite_jwt.py              ← Validación JWT contra Appwrite
```

## Decisiones

### Dónde vive la verdad del rol
- **Appwrite Labels** (fuente primaria para backend).
- **Documento `users.rol`** (fuente secundaria, para queries y UI).
- Deben mantenerse sincronizados. El bootstrap y el endpoint de creación de usuarios siempre los escriben juntos.

### Session cookie vs JWT
- Appwrite por default usa session cookie (httpOnly) en web. Para el backend, el frontend puede obtener el JWT temporal con `account.createJWT()` y adjuntarlo al request.
- Los JWTs son cortos (15 min default) → renovarlos en cada llamada al backend.

### Filtrado por branch en jefes
- Frontend SIEMPRE filtra por las branches autorizadas antes de hacer queries a Appwrite.
- Backend verifica que cualquier `branch_id` en un request `/optimize` pertenezca a las branches del jefe (via query a `branch_managers`).

## Librerías

- Frontend: `appwrite` (Web SDK).
- Backend: `httpx` para validar JWT contra Appwrite.

## Riesgos

- Labels pueden quedar desincronizados si alguien modifica por la consola. Mitigación: script `audit-roles.ts` que compara y reporta inconsistencias.
- JWT renovado en cada request puede agregar latencia. Mitigación: cachear en memoria client-side por 10 minutos.
