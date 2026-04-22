# Tasks — Spec 006: Auth

## Estado: 🔲 Pendiente

---

- [ ] **Task 1: Scaffolding Frontend**
  - Copiar configuraciones: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`.
  - Copiar estilos: `app/globals.css`.
  - Copiar componentes UI básicos (Button, Input, Label, Card, Form, etc.) necesarios para login.
  - Ejecutar `npm install` en el workspace de frontend.

- [ ] **Task 2: Scaffolding Backend**
  - Crear `requirements.txt` en `v2/backend/`.
  - Crear `app/main.py` y `app/core/config.py` básicos.

- [ ] **Task 3: Client de Appwrite Frontend**
  - Copiar y adaptar `lib/auth/appwrite-client.ts`.
  - Copiar `lib/auth/use-current-user.ts`.

- [ ] **Task 4: Página y Flujo de Login**
  - Copiar y adaptar `app/login/page.tsx`.
  - Copiar `app/page.tsx` para redirección raíz.

- [ ] **Task 5: Middleware y Layouts Protegidos**
  - Copiar `middleware.ts` en `v2/frontend/src/middleware.ts`.
  - Adaptar `app/admin/layout.tsx` (con un Sidebar v2 que apunte a las rutas correctas).
  - Adaptar `app/jefe/layout.tsx`.

- [ ] **Task 6: Dependencias Backend para Auth**
  - Copiar y adaptar `services/appwrite_jwt.py`.
  - Copiar y adaptar `api/deps.py`.

- [ ] **Task 7: Script y Tests**
  - Copiar `scripts/create-first-admin.ts` asegurando que use `DB = main-v2`.
  - Escribir `tests/e2e/auth-v2.spec.ts` en frontend.
