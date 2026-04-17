# Appwrite Setup

Guía para configurar Appwrite desde cero para este proyecto. El proceso está
completamente automatizado via scripts — no hace falta crear colecciones ni
atributos a mano.

## Pre-requisitos

- Appwrite self-hosted corriendo (actualmente en `https://appwrite.dpmake.cl`).
- Node.js 18+ instalado.
- Dependencias instaladas: `npm install` en la raíz del repo.

## 1. Crear el proyecto en Appwrite

Desde la consola web de Appwrite:

1. **Create Project** → Nombre: `shift-optimizer`.
2. Copia el **Project ID** a tu `.env`.
3. En **Settings → Add Platform**, registra:
   - **Web**: `http://localhost:3000` (dev) + dominio de producción cuando corresponda.

## 2. Crear una API Key

**Auth → API Keys → Create API Key**:

- Nombre: `bootstrap`
- Scopes mínimos necesarios:

```
databases.read    databases.write
collections.read  collections.write
attributes.read   attributes.write
indexes.read      indexes.write
documents.read    documents.write
users.read        users.write
```

Copia el key generado. Lo necesitás en el paso siguiente.

## 3. Configurar el `.env`

Copia `.env.example` a `.env` y completa los valores:

```env
APPWRITE_ENDPOINT=https://appwrite.dpmake.cl/v1
APPWRITE_PROJECT_ID=<tu-project-id>
APPWRITE_API_KEY=<tu-api-key>
APPWRITE_DATABASE_ID=main

NEXT_PUBLIC_APPWRITE_ENDPOINT=https://appwrite.dpmake.cl/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<tu-project-id>
NEXT_PUBLIC_APPWRITE_DATABASE_ID=main
NEXT_PUBLIC_OPTIMIZER_URL=http://localhost:8000

FIRST_ADMIN_EMAIL=tu-email@dominio.com
FIRST_ADMIN_PASSWORD=contraseña-segura
FIRST_ADMIN_NAME=Tu Nombre
```

> **Nunca** commitees el `.env` con keys reales — está en `.gitignore`.

## 4. Ejecutar el bootstrap

Crea la database `main` y las 11 colecciones con sus atributos, índices y
permisos por rol. Es **idempotente** — se puede correr múltiples veces sin
duplicar nada.

```bash
npm run bootstrap:appwrite
```

Colecciones creadas:
`users`, `branches`, `branch_type_config`, `shift_catalog`, `workers`,
`branch_managers`, `holidays`, `worker_constraints`, `proposals`,
`assignments`, `audit_log`.

## 5. Cargar los seeds

```bash
npm run seed:all
```

Esto carga en orden:

| Comando | Datos |
|---|---|
| `npm run seed:shifts` | 10 turnos en `shift_catalog` |
| `npm run seed:branch-types` | 5 tipos de sucursal en `branch_type_config` |
| `npm run seed:holidays` | 10 feriados (2026 + 2027) en `holidays` |

Para agregar feriados de un año futuro:

```bash
npx tsx scripts/seed-holidays.ts 2028
```

## 6. Crear el primer admin

```bash
npm run create:admin
```

Lee `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD` y `FIRST_ADMIN_NAME` del `.env`.
También acepta argumentos por CLI:

```bash
npx tsx scripts/create-first-admin.ts email@ejemplo.com contraseña "Nombre Apellido"
```

Crea:
- Usuario en Appwrite Auth.
- Label `admin` en ese usuario.
- Documento en colección `users` con permisos de lectura propios.

## 7. Verificar

Revisá en la consola Appwrite que:

- La database `main` tiene las 11 colecciones.
- `shift_catalog` tiene 10 documentos.
- `branch_type_config` tiene 5 documentos.
- `holidays` tiene 10 documentos.
- El usuario admin aparece en **Auth → Users** con label `admin`.

## Notas sobre permisos y labels

Los permisos están configurados con dos labels:

| Label | Valor en Appwrite | Rol en la app |
|---|---|---|
| `admin` | `admin` | Acceso total |
| `jefesucursal` | `jefesucursal` | Vista restringida a sus sucursales |

> Appwrite 1.6 solo permite labels alfanuméricos (sin guión bajo). El campo
> `rol` en la colección `users` sigue usando `jefe_sucursal` con guión bajo —
> son dos cosas distintas.

Para asignar el label `jefesucursal` a un nuevo jefe de sucursal, ir a
**Auth → Users → [usuario] → Labels → Add** y escribir `jefesucursal`.

## Reinstalación desde cero

Si necesitás resetear todo:

1. Eliminar la database `main` desde la consola Appwrite.
2. Eliminar todos los usuarios en **Auth → Users**.
3. Correr el flujo completo desde el paso 4.
