# F5 — Grupos de sucursales

## Problema

Un supervisor puede tener 4 sucursales. Quiere generar un calendario combinado para 2 de ellas y calendarios separados para las otras 2. Hoy tiene que re-seleccionar cada vez — no hay forma de guardar esa agrupación.

## Concepto

Un **grupo** es una agrupación persistente de sucursales que se visualizan y gestionan juntas. Una sucursal pertenece a máximo un grupo.

**Ejemplo:**
Supervisor tiene: Subaru Mall Plaza Oeste, Mayorista, DyP Vista Hermosa, Transportes Maipú.
Agrupa las dos primeras → queda con 3 unidades:
1. Grupo "Subaru Mall Plaza Oeste - Mayorista"
2. DyP Vista Hermosa (individual)
3. Transportes Maipú (individual)

## Modelo de datos

```prisma
model BranchGroup {
  id        String   @id @default(cuid())
  nombre    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  branches  Branch[]
}
```

`Branch` agrega:
```prisma
groupId String?
group   BranchGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
```

## Permisos

| Acción | Admin | Supervisor |
|--------|-------|------------|
| Ver grupos de sus sucursales | ✓ | ✓ |
| Crear grupo (desde sus sucursales sin grupo) | ✓ | ✓ |
| Disolver grupo (devuelve sucursales a individuales) | ✓ | ✗ |
| Mover sucursal entre grupos | ✓ | ✗ |
| Renombrar grupo | ✓ | ✗ |

## Nombre del grupo

Se genera automáticamente: nombres de sucursales del grupo unidos con ` - `.
Ejemplo: `"Subaru Mall Plaza Oeste - Mayorista"`.
El admin puede renombrarlo manualmente.

## Flujo supervisor (`/supervisor`)

La página `/supervisor` reemplaza la lista plana de checkboxes por:

### Sección 1 — Grupos existentes
Cards de grupos ya formados, con:
- Nombre del grupo
- Lista de sucursales que contiene
- Botón "Ver calendario" → `/supervisor/calendario?groupId=xxx&year=Y&month=M`

### Sección 2 — Sucursales sin grupo
Checkboxes de sucursales que aún no pertenecen a ningún grupo.
- Seleccionar 2 o más → aparece botón "Agrupar selección"
- Click → crea grupo con nombre auto-generado, recarga página

También se puede ir al calendario de una sucursal individual desde aquí.

## Flujo admin (`/admin/grupos`)

Nueva página en admin nav:
- Listado de todos los grupos con sus sucursales
- Crear grupo manual (seleccionar cualquier sucursal sin grupo)
- Disolver grupo (botón por fila) → sucursales vuelven a estado individual
- Renombrar grupo
- Ver calendario del grupo → `/supervisor/calendario?groupId=xxx&year=Y&month=M`

## Vista calendario de grupo

`/supervisor/calendario?groupId=xxx` (o `?branchId[]=...` como ahora para individuales)

- Muestra todos los equipos de todas las sucursales del grupo
- Botón "Generar todos" → genera calendarios para cada equipo del grupo
- Botón "Generar" por equipo individual
- Exportar por sucursal: igual que hoy
- Exportar por grupo: Excel con una hoja por sucursal del grupo

## Impacto en código

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar `BranchGroup`, `Branch.groupId` |
| `src/app/supervisor/page.tsx` | Rediseño: grupos + sucursales sin grupo |
| `src/app/supervisor/SupervisorBranchSelector.tsx` | Reemplazar por nueva UI de grupos |
| `src/app/supervisor/calendario/page.tsx` | Soporte `groupId` en query, botones generar |
| `src/app/admin/grupos/page.tsx` | Nueva página admin |
| `src/app/api/grupos/route.ts` | CRUD de grupos |
| `AdminShell.tsx` | Agregar link "Grupos" en nav |
| `SupervisorShell.tsx` | Fix "Shift Optimizer" → "Shift Planner" |
| Export Excel | Soporte exportar grupo completo |

## Fuera de scope (F5)

- Una sucursal en múltiples grupos (explícitamente descartado)
- Grupos con sucursales de distintos supervisores sin que el admin los asigne
