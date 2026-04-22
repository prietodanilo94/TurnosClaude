# Spec 007 — Overrides Post-Optimización

## Contexto

Después de que el optimizer genera el calendario de slots, el admin puede ajustar turnos individualmente sin regenerar todo. Esto es especialmente útil para:
- Cambiar el tipo de turno de un slot (APE → CIE).
- Marcar un día como libre cuando el solver lo asignó con turno.
- Proteger un domingo libre o forzar que alguien trabaje un domingo específico.

Los overrides NO son restricciones para el optimizer — son ajustes post-cálculo aplicados manualmente.

## Tipos de override

| tipo | Descripción | Alcance |
|------|-------------|---------|
| `cambiar_turno` | Cambiar el tipo de turno de un slot (mantiene el día trabajado) | 1 slot (día × posición) |
| `marcar_libre` | Convertir un slot trabajado en día libre | 1 slot |
| `marcar_trabajado` | Convertir un día libre en slot trabajado (elige el turno) | 1 día |
| `proteger_domingo` | Forzar domingo libre en revisiones futuras | 1 domingo |

## Colección Appwrite: `slot_overrides`

| Atributo | Tipo | Req | Notas |
|----------|------|-----|-------|
| `$id` | string | sí | Auto |
| `proposal_id` | string | sí | FK → `proposals.$id` |
| `fecha` | string | sí | `YYYY-MM-DD` |
| `slot_numero` | integer | no | Si aplica (null para `marcar_libre` sin slot) |
| `tipo` | enum | sí | Ver tabla de tipos |
| `shift_id_original` | string | no | ID del turno original (antes del override) |
| `shift_id_nuevo` | string | no | ID del turno nuevo (para `cambiar_turno` y `marcar_trabajado`) |
| `notas` | string | no | Razón del cambio (texto libre) |
| `creado_por` | string | sí | FK → `users.$id` |
| `$createdAt` | datetime | sí | Auto |

## UI — Menú de override

Al hacer **clic derecho** (o long press en móvil) sobre un slot del calendario, se abre un menú contextual:

```
┌─────────────────────────────┐
│  Slot: Apertura  (Lun 12)   │
├─────────────────────────────┤
│  ✏️  Cambiar turno          │
│  🔴  Marcar como libre      │
│  📝  Agregar nota           │
└─────────────────────────────┘
```

Al hacer clic sobre un día **libre**:
```
┌─────────────────────────────┐
│  Día libre  (Dom 15)        │
├─────────────────────────────┤
│  ➕  Agregar turno          │
│  🔒  Proteger (no cambiar)  │
└─────────────────────────────┘
```

Al elegir "Cambiar turno", aparece un selector con los turnos disponibles para ese rotation_group.

## Reglas de validación

- Un override `marcar_trabajado` en domingo solo se permite si el worker aún no superó el máximo de domingos trabajados del mes.
- Un override `marcar_libre` solo se permite si no deja el día sin cobertura mínima (mostrar advertencia si sí lo hace, pero no bloquear).
- Los overrides se muestran en el calendario con ícono ✏️ (ver spec 005).

## Criterios de aceptación

- [ ] Menú contextual disponible en cada slot del calendario.
- [ ] Los 4 tipos de override funcionan y persisten en Appwrite.
- [ ] El calendario se actualiza inmediatamente al aplicar un override (optimistic update).
- [ ] Los overrides se exportan correctamente al Excel (spec 009).
- [ ] Se puede deshacer un override (botón "Revertir" en el menú contextual si hay override activo).
- [ ] Log en `audit_log` por cada override aplicado.
