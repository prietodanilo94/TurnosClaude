# Spec 006 — Autenticación y Permisos v2

## Contexto

El sistema de auth es idéntico al de v1. Se copia y adapta apuntando a la DB `main-v2` de Appwrite.
No se reutiliza código de v1 directamente — se copia en `v2/frontend/` para mantener independencia.

## Roles

Igual que v1:
- `admin` — acceso total.
- `jefe_sucursal` — vista restringida: solo sus sucursales asignadas.

## Componentes a copiar de v1 (y adaptar)

| Archivo v1 | Destino v2 | Cambios |
|------------|-----------|---------|
| `lib/auth/appwrite-client.ts` | `v2/frontend/src/lib/auth/appwrite-client.ts` | Cambiar endpoint de DB a `main-v2` |
| `app/login/page.tsx` | ídem en v2 | Cambiar título/branding a "v2" |
| `lib/auth/use-current-user.ts` | ídem en v2 | Sin cambios |
| `middleware.ts` | ídem en v2 | Sin cambios |
| `admin/layout.tsx` | ídem en v2 | Nav lateral adaptado (links v2) |
| `jefe/layout.tsx` | ídem en v2 | Sin cambios |
| `backend/app/services/appwrite_jwt.py` | ídem en v2 | Sin cambios |
| `backend/app/api/deps.py` | ídem en v2 | Sin cambios |

## Script de bootstrap

`v2/scripts/create-first-admin.ts` — crea el admin inicial en Appwrite (misma cuenta que v1: `prieto.danilo94@gmail.com`).

> Como es el mismo Appwrite, el usuario ya existe. El script solo necesita asignar el label de admin en el proyecto v2.

## Criterios de aceptación

- [ ] Login funciona apuntando a `main-v2`.
- [ ] Middleware protege `/admin/*` y `/jefe/*`.
- [ ] El admin puede iniciar sesión con las mismas credenciales de v1.
- [ ] Guard de branch: jefe solo ve sus sucursales asignadas.
- [ ] Tests E2E: `auth-v2.spec.ts` (login, redirect, 403).
