# Appwrite Setup

Esta guía documenta cómo configurar tu instancia de Appwrite para este proyecto. Se ejecuta **una vez** al inicio, y luego se versiona como código (ver spec 001).

## Pre-requisitos

- Appwrite self-hosted corriendo en tu servidor (lo tienes ✓).
- Acceso admin a la consola de Appwrite.
- Instalada la **Appwrite CLI**: https://appwrite.io/docs/tooling/command-line/installation

```bash
npm install -g appwrite-cli
appwrite login
```

## 1. Crear el proyecto

Desde la consola web de Appwrite:

1. **Create Project** → Nombre: `shift-optimizer`.
2. Copia el **Project ID** a tu `.env.local` como `NEXT_PUBLIC_APPWRITE_PROJECT_ID`.
3. En **Settings → Add Platform**, registra:
   - **Web**: `http://localhost:3000` (dev) + el dominio de producción.

## 2. Crear una API Key para el backend

**Auth → API Keys → Create API Key**:

- Nombre: `backend-optimizer`
- Scopes: `users.read`, `databases.read`, `sessions.write`
- Copia el key en tu `.env` del backend como `APPWRITE_API_KEY`.

## 3. Crear la base de datos

**Databases → Create Database**:

- Nombre: `shift-optimizer-db`
- ID: `main`

Las colecciones y atributos los crearemos programáticamente con un script en la Spec 001 para que sean reproducibles.

## 4. Variables de entorno

### Frontend `.env.local`

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://appwrite.tu-dominio.com/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=xxxxxxxxxx
NEXT_PUBLIC_APPWRITE_DATABASE_ID=main
NEXT_PUBLIC_OPTIMIZER_URL=http://localhost:8000
```

### Backend `.env`

```env
APPWRITE_ENDPOINT=https://appwrite.tu-dominio.com/v1
APPWRITE_PROJECT_ID=xxxxxxxxxx
APPWRITE_API_KEY=standard_xxxxxxxxx...
APPWRITE_DATABASE_ID=main
```

## 5. Primer usuario admin

**Auth → Users → Create User**:

- Email: tu email
- Password: (fuerte)
- Luego, en la consola, ve a **Databases → main → users → Create Document** y crea un documento con tu `$id` (el mismo de Auth) y `rol = "admin"`.

Alternativa: el script de bootstrap de la Spec 001 creará el primer admin por CLI.

## 6. Labels (para permisos por rol)

Appwrite usa **labels** para permisos basados en rol. En la consola:

**Auth → Users → [tu usuario] → Labels → Add**:
- `admin`

Luego en cada colección podremos usar `Role.label("admin")` en las reglas de permisos.

## 7. Verificación

- Puedes loguearte desde el frontend una vez implementada la Spec 005.
- El backend puede validar tu JWT.
- Tienes acceso a todas las colecciones como admin.

## Notas

- **No commitees** ningún `.env` con keys reales al repo.
- Para producción, genera una API Key distinta con scopes más acotados.
- Si quieres email transaccional (invitación a jefes de sucursal), configura SMTP en **Settings → SMTP**. Para el MVP esto no es necesario (Opción A de creación manual de usuarios).
