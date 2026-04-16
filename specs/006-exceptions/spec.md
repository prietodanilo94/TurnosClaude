# Spec 006 — Excepciones por Trabajador

## Contexto

Algunos trabajadores tienen restricciones particulares: un día de la semana que no pueden trabajar, un turno que no hacen, vacaciones programadas, etc. Estas excepciones deben alimentarse al optimizador para que genere turneros respetándolas.

## Objetivo

1. Panel de admin para gestionar excepciones por trabajador.
2. Las excepciones se incluyen automáticamente en cada llamada a `/optimize`.
3. Auditoría: quién creó qué excepción y cuándo.

## Tipos de excepciones

| Tipo              | Valor                                     | Efecto en optimizador                              |
|-------------------|-------------------------------------------|----------------------------------------------------|
| `dia_prohibido`   | `"martes"`, `"domingo"`, etc.             | Nunca se le asigna turno ese día de la semana      |
| `turno_prohibido` | shift_id (ej: `"S_09_19"`)                | Nunca se le asigna ese turno específico            |
| `vacaciones`      | rango `fecha_desde` → `fecha_hasta`       | Sin turnos durante ese rango                       |
| `dia_obligatorio_libre` | fecha exacta (ISO)                   | Día libre forzado (ej: cumpleaños, cita médica)    |

> El tipo `dia_obligatorio_libre` se implementa como un rango de vacaciones de 1 día para simplificar el backend.

## UI del admin

### `/admin/trabajadores/[workerId]/excepciones`

```
┌──────────────────────────────────────────────────────────────┐
│ Excepciones de: ABARZUA VARGAS ANDREA (17.286.931-9)         │
│ Sucursal: NISSAN IRARRAZAVAL                                 │
│                                                [+ Nueva excepción] │
├──────────────────────────────────────────────────────────────┤
│ ▸ Día prohibido: Martes                  [Editar] [Eliminar] │
│   Notas: Estudia los martes                                   │
│   Creada por: admin@x.com el 2026-04-02                       │
├──────────────────────────────────────────────────────────────┤
│ ▸ Vacaciones: 10-may-2026 al 20-may-2026   [Editar] [Eliminar]│
│   Creada por: admin@x.com el 2026-04-10                       │
└──────────────────────────────────────────────────────────────┘
```

### Diálogo de nueva excepción

```
┌───────────────────────────────────────────────┐
│ Nueva excepción                                │
│                                                │
│ Tipo: [Día prohibido           ▼]              │
│ Día: [Lunes Martes Miercoles...]   ← según tipo│
│ Fecha desde: [__/__/____]                      │
│ Fecha hasta: [__/__/____]                      │
│ Turno: [____________▼]                         │
│ Notas: [__________________________________]    │
│                                                │
│                 [Cancelar] [Crear]             │
└───────────────────────────────────────────────┘
```

Los campos se muestran/ocultan según el tipo seleccionado.

## Integración con optimizador

El frontend, al armar el payload para `POST /optimize`, hace:

```ts
const workersPayload = workers.map(w => ({
  rut: w.rut,
  nombre: w.nombre_completo,
  constraints: exceptionsFor(w.$id).map(toOptimizerConstraint)
}))
```

Y `toOptimizerConstraint` hace el mapeo al shape que espera el backend.

## Acceso por rol

- Admin: crear, editar, eliminar cualquier excepción.
- Jefe de sucursal: solo **ver** las excepciones de los trabajadores de sus sucursales (read-only). No pueden crearlas. (Se puede habilitar para ellos en v2.)

## Criterios de aceptación

- [ ] Un admin puede agregar las 4 tipos de excepciones y verlas listadas.
- [ ] Al correr el optimizador para un mes que incluye vacaciones de un trabajador, el turnero resultante no le asigna turnos en ese rango.
- [ ] Las excepciones tienen auditoría (`creado_por`, `$createdAt`).
- [ ] Un jefe ve las excepciones pero no puede editarlas.
- [ ] Validación: no se puede crear "día prohibido = lunes" duplicado para el mismo trabajador.
