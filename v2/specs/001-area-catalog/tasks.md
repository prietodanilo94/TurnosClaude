# Tasks — Spec 001: Catálogo de Áreas

## Estado: ✅ Completa

---

- [ ] **Task 1** — Setup inicial: `v2/package.json` + `v2/tsconfig.json` + `v2/.env.example`
- [ ] **Task 2** — `v2/scripts/bootstrap-appwrite-v2.ts`: crea la colección `area_catalog` en DB `main-v2` (idempotente)
- [ ] **Task 3** — `v2/scripts/seed-area-catalog.ts`: carga las 63 áreas (idempotente)
- [ ] **Task 4** — Tipos TypeScript: `v2/frontend/src/types/models.ts` (stub con `AreaCatalog`, `Clasificacion`, `TipoFranja`)
- [ ] **Task 5** — Modelo Pydantic: `v2/backend/app/models/schemas.py` (stub con `AreaCatalog`)
- [ ] **Task 6** — Helper frontend: `v2/frontend/src/lib/area-catalog.ts` → función `lookupArea(codigo: string): AreaCatalog | null`
- [ ] **Task 7** — Helper backend: `v2/backend/app/services/area_catalog.py` → función `lookup_area(codigo: str) -> AreaCatalog | None`

## Notas

- Las Tasks 4–7 son stubs pequeños. El código real de frontend/backend se construye en specs siguientes.
- Antes de la Task 2, el usuario debe crear manualmente la DB `main-v2` en Appwrite (no se puede crear por script en Appwrite Cloud/self-hosted sin permisos de consola).
