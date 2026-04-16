# Plan — Spec 006

## Archivos

```
frontend/src/
├── app/admin/trabajadores/
│   ├── page.tsx                          ← Lista con buscador por RUT/nombre
│   └── [workerId]/
│       ├── page.tsx                      ← Ficha del trabajador
│       └── excepciones/
│           ├── page.tsx                  ← Lista de excepciones
│           └── components/
│               ├── ExceptionsList.tsx
│               └── NewExceptionDialog.tsx
├── lib/exceptions/
│   ├── api.ts                            ← CRUD contra Appwrite
│   ├── to-optimizer-constraint.ts        ← Mapeo a shape backend
│   └── validation.ts                     ← Validaciones client-side
```

## Validaciones al crear

- `dia_prohibido`: no puede duplicarse (un trabajador no puede tener dos "martes prohibido").
- `turno_prohibido`: no puede duplicarse.
- `vacaciones`: `fecha_desde <= fecha_hasta`. No puede solaparse con otra vacación del mismo trabajador.
- `dia_obligatorio_libre`: almacenado como `vacaciones` con desde=hasta=ese día.

## Integración

Agregar a `lib/optimizer/build-payload.ts` (de spec 003 en frontend):

```ts
async function buildOptimizePayload(branchId, year, month) {
  // ...
  const workers = await fetchWorkers(branchId)
  const constraints = await fetchConstraintsFor(workers.map(w => w.$id))
  return {
    branch: ...,
    month: ...,
    workers: workers.map(w => ({
      rut: w.rut,
      nombre: w.nombre_completo,
      constraints: constraints
        .filter(c => c.worker_id === w.$id)
        .map(toOptimizerConstraint)
    })),
    holidays: ...,
    shift_catalog: ...,
    franja_por_dia: ...,
    parametros: ...,
  }
}
```

## Consideración de permisos

El fetch de excepciones para un jefe está filtrado por las branches autorizadas. Si un jefe intenta leer excepciones de un trabajador que no es de su sucursal → 403.
