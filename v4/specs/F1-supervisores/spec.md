# F1 — Supervisores como entidad central

## Problema

Actualmente la app organiza por sucursales (`Branch`). El negocio opera por supervisores: cada supervisor tiene N sucursales, y necesita ver y gestionar todas sus sucursales en conjunto.

## Modelo de datos actual

```
Branch → BranchTeam → Worker
```

## Modelo propuesto

```
Supervisor → Branch (muchos-a-muchos) → BranchTeam → Worker
```

### Nueva entidad `Supervisor`

```prisma
model Supervisor {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  passwordHash String?
  branches     SupervisorBranch[]
  createdAt    DateTime @default(now())
}

model SupervisorBranch {
  supervisorId String
  branchId     String
  supervisor   Supervisor @relation(fields: [supervisorId], references: [id])
  branch       Branch     @relation(fields: [branchId], references: [id])
  @@id([supervisorId, branchId])
}
```

### Cambio en auth

- Login supervisor: por email (igual que admin). Sesión incluye `role: "supervisor"`, `supervisorId`.
- Middleware: `/supervisor/*` requiere rol supervisor o admin.
- El rol `jefe` actual en JWT se renombra a `supervisor`.

## Flujo de importación Excel

El Excel tiene columna `Supervisor` en cada fila de vendedor. Al hacer sync de dotación:

1. Leer valor de columna `Supervisor` por fila.
2. Si no existe supervisor con ese nombre → crear registro `Supervisor` (sin email, sin password).
3. Linkear `SupervisorBranch` entre ese supervisor y la sucursal de la fila.
4. Si ya existe la relación → no hacer nada (idempotente).

**El email del supervisor** se asigna después desde el panel admin (para habilitarle login).

## Vista supervisor

- `/supervisor` → lista de sucursales asociadas al supervisor logueado.
- Puede seleccionar 1, varias o todas sus sucursales.
- El calendario se genera con dotación combinada de las sucursales seleccionadas.
- Multi-selección: checkboxes en listado + botón "Ver calendario combinado".

## Vista admin

- `/admin/supervisores` → listado de todos los supervisores con sus sucursales.
- Acciones: asignar email/password (para habilitar login), ver sucursales, agregar/quitar sucursal.

## Impacto en código

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar `Supervisor`, `SupervisorBranch` |
| `src/lib/excel/parser.ts` | Leer columna `Supervisor`, retornar en sync payload |
| `src/app/api/dotacion/sync/route.ts` | Crear/linkear supervisores al sincronizar |
| `src/middleware.ts` | Agregar ruta `/supervisor/*` |
| `src/app/supervisor/` | Nueva sección (nueva carpeta) |
| `src/app/admin/supervisores/` | Nueva página de gestión |
| JWT payload | Agregar `supervisorId` cuando rol = supervisor |

## Fuera de scope (F1)

- Bloqueos de fechas (→ F2)
- Historial (→ F4)
- Cambio de nombre de sucursales
