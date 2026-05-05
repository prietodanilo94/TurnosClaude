# F2 — Bloqueo de vendedores por rango de fechas

## Problema

Un vendedor puede estar de vacaciones, licencia u otro permiso. Durante ese período no debe aparecer en el calendario. Hoy no hay forma de marcarlo — el generador lo asigna igual.

## Modelo de datos

```prisma
model WorkerBlock {
  id        String   @id @default(cuid())
  workerId  String
  worker    Worker   @relation(fields: [workerId], references: [id])
  startDate DateTime
  endDate   DateTime
  motivo    String?  // "vacaciones", "licencia", "permiso", etc.
  createdAt DateTime @default(now())
}
```

## Reglas

- `startDate` y `endDate` son fechas inclusivas (sin hora).
- Un vendedor puede tener múltiples bloques no solapados.
- Si un bloqueo nuevo solapa con uno existente del mismo vendedor → el server rechaza con 400.
- El generador de calendario ignora al vendedor en días bloqueados (no asigna slot).
- Si el vendedor ya tenía slot asignado en esas fechas y se agrega un bloqueo → el slot se elimina o marca como vacío.

## UI

### Dónde se gestiona

Desde la vista de detalle del vendedor (`/admin/sucursales/[id]` → WorkerAccessManager o panel similar). Opciones:
- Listado de bloqueos activos y futuros del vendedor.
- Formulario: motivo (opcional), fecha inicio, fecha fin.
- Botón eliminar bloqueo.

### Indicador en calendario

- Días bloqueados del vendedor muestran celda con color distinto (gris) y tooltip con motivo.
- En vista global: la fila del vendedor bloqueado muestra celda vacía con indicador visual.

## Impacto en código

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar `WorkerBlock` |
| `src/lib/calendar/generator.ts` | Omitir vendedor en días bloqueados |
| `src/app/api/blocks/route.ts` | CRUD de bloqueos (nuevo) |
| `CalendarView.tsx` | Renderizar celdas bloqueadas |
| Panel de vendedor | UI para gestionar bloqueos |

## Fuera de scope (F2)

- Notificaciones por bloqueo (→ F4)
- Bloqueo de sucursales completas
