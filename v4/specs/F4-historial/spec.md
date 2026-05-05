# F4 — Historial de movimientos + webhook N8N

## Problema

No hay trazabilidad de quién hizo qué en el sistema. No se sabe si un calendario fue generado, modificado, o por quién. El equipo necesita recibir notificaciones por mail de los cambios relevantes.

## Modelo de datos

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?  // null si es acción de sistema
  userEmail  String?
  userRole   String?
  action     String   // ver tabla de acciones
  entityType String   // "calendar", "worker", "branch", "supervisor", "block"
  entityId   String?
  metadata   String?  // JSON con detalles del cambio
  branchId   String?  // para filtrar por sucursal
  createdAt  DateTime @default(now())
}
```

### Acciones registradas

| `action` | Descripción |
|----------|-------------|
| `calendar.generate` | Se generó un calendario |
| `calendar.delete` | Se eliminó/recalculó un calendario |
| `calendar.assign` | Se asignó manualmente un vendedor a un slot |
| `dotacion.sync` | Se sincronizó dotación desde Excel |
| `worker.block` | Se bloqueó un vendedor por fechas |
| `worker.unblock` | Se eliminó un bloqueo |
| `supervisor.create` | Se creó un supervisor |
| `supervisor.link` | Se asignó sucursal a supervisor |

## Registro automático

Un helper `logAction(action, entityType, entityId, metadata, req)` se llama al final de cada route que modifica datos. Obtiene el usuario desde la cookie JWT.

```typescript
// Ejemplo de uso en un route handler
await logAction("calendar.generate", "calendar", calendar.id, {
  branchId,
  year,
  month,
  workerCount: workers.length,
}, req)
```

## Vista admin

- `/admin/historial` — tabla paginada con filtros por sucursal, acción, fecha y usuario.
- Columnas: fecha, usuario, acción, sucursal, detalle.
- Exportar historial a Excel (opcional, fuera de scope inicial).

## Webhook N8N

Después de registrar en DB, si la acción está en la lista de acciones notificables, se envía POST a la URL de N8N configurada en `.env`:

```
N8N_WEBHOOK_URL=https://n8n.ejemplo.com/webhook/shift-planner
```

### Payload enviado a N8N

```json
{
  "action": "calendar.generate",
  "entityType": "calendar",
  "entityId": "cuid...",
  "userEmail": "admin@empresa.cl",
  "branchId": "cuid...",
  "branchName": "Sucursal Centro",
  "timestamp": "2026-05-05T10:00:00Z",
  "metadata": { "year": 2026, "month": 5, "workerCount": 8 }
}
```

### Acciones notificables (configurables)

Por defecto notificar: `calendar.generate`, `calendar.delete`, `dotacion.sync`.

N8N recibe el POST y construye el email con los datos del payload.

## Impacto en código

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar `AuditLog` |
| `src/lib/audit/log.ts` | Helper `logAction()` |
| `src/lib/audit/webhook.ts` | Envío a N8N (fire-and-forget, no bloquea respuesta) |
| Todos los routes que modifican datos | Llamar `logAction()` al final |
| `src/app/admin/historial/page.tsx` | Vista de historial |
| `.env.example` | Agregar `N8N_WEBHOOK_URL` |

## Notas

- El webhook es fire-and-forget: si falla, solo se loguea el error, no se rompe la operación.
- `metadata` se guarda como JSON string en SQLite.
- El historial no se borra (append-only). Para limpiar, migración manual.
