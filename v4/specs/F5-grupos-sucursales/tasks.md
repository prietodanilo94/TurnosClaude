# F5 — Tasks

## Fase 1: Modelo
- [ ] Agregar `BranchGroup` y `Branch.groupId` a `schema.prisma`
- [ ] `prisma db push` en local y en servidor

## Fase 2: API
- [ ] `GET /api/grupos` — listar grupos con sus sucursales
- [ ] `POST /api/grupos` — crear grupo con branchIds + nombre auto-generado
- [ ] `PATCH /api/grupos/[id]` — renombrar (admin only)
- [ ] `DELETE /api/grupos/[id]` — disolver grupo, groupId → null en branches (admin only)

## Fase 3: Vista supervisor
- [ ] Rediseñar `/supervisor/page.tsx`: sección grupos + sección sin grupo
- [ ] `SupervisorBranchSelector` → reemplazar por nuevo componente de grupos
- [ ] Crear grupo desde checkboxes de sucursales sin grupo
- [ ] Links a `/supervisor/calendario?groupId=xxx` y a calendario individual

## Fase 4: Vista calendario con grupos
- [ ] `/supervisor/calendario/page.tsx`: soporte `?groupId=xxx` (resolver branchIds del grupo)
- [ ] Botón "Generar" por equipo (POST `/api/calendars`, luego refresh)
- [ ] Botón "Generar todos" (genera todos los equipos del grupo en secuencia)
- [ ] Exportar grupo: Excel multi-hoja por sucursal

## Fase 5: Vista admin
- [ ] `/admin/grupos/page.tsx`: listado, crear, disolver, renombrar
- [ ] Link "Grupos" en `AdminShell.tsx`
- [ ] Fix "Shift Planner" en `SupervisorShell.tsx`

## Fase 6: QA
- [ ] Supervisor crea grupo → persiste en DB
- [ ] Admin disuelve grupo → sucursales vuelven a individuales
- [ ] Sucursal sin grupo puede ser agrupada
- [ ] Sucursal ya en grupo no aparece en selector de otra agrupación
