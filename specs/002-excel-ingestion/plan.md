# Plan — Spec 002

## Stack
- SheetJS (`xlsx`) en el navegador.
- `zod` para validar filas.
- Appwrite Web SDK para upserts.

## Archivos

```
frontend/src/
├── app/admin/dotacion/
│   ├── page.tsx                         ← Ruta principal
│   └── components/
│       ├── ExcelDropZone.tsx
│       ├── PreviewTable.tsx
│       ├── NewBranchesPanel.tsx         ← Asigna tipo_franja a sucursales nuevas
│       └── SyncConfirmDialog.tsx
├── lib/
│   ├── excel-parser.ts                  ← SheetJS + normalización
│   ├── rut-utils.ts                     ← Validación y normalización RUT
│   └── sync-dotacion.ts                 ← Lógica de upsert contra Appwrite
└── types/dotacion-sync.ts
```

## Algoritmo de sync (pseudocódigo)

```
existingBranches = fetchAll("branches")
existingWorkers = fetchAll("workers", filter: activo=true)

newRows = parseExcel(file)
seenRuts = set()

for row in newRows:
  seenRuts.add(row.rut)
  branch = existingBranches.find(codigo_area = row.codigo_area)
  if not branch:
    branch = createBranch(codigo_area, nombre, tipo_franja=row.tipo_asignado_por_admin)

  existing = existingWorkers.find(rut = row.rut)
  if existing:
    if existing.branch_id != branch.$id or otros cambios:
      update(existing, ...)
  else:
    create(worker, branch_id=branch.$id, ...)

# Soft-delete
for worker in existingWorkers:
  if worker.rut not in seenRuts:
    update(worker, activo=false)

log(audit_log, "upload_excel", metadata={creados, actualizados, desactivados})
```

## Validación RUT (Chile)

Función `validarRut(rut: string): { valido: boolean; normalizado: string }`.

Pasos:
1. Quitar puntos, guiones, espacios. Pasar a mayúscula.
2. Separar cuerpo y DV.
3. Calcular DV módulo 11 y comparar.
4. Retornar `"XXXXXXXX-X"` si válido.

## Riesgos

- Archivos Excel con nombres de columnas diferentes → primero detectar encabezados por nombre, no por posición.
- RUT con formatos variados (con/sin puntos, con/sin guion, con K minúscula).
- Área con formato inesperado (ej: sin número al inicio) → reportar como error de fila.
- Sucursales con el mismo código pero distinto nombre → usar el código como key, warnear del conflicto de nombre.
