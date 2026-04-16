# Spec 008 — Feriados Irrenunciables

## Contexto

En Chile existen **feriados irrenunciables**: días en los que la ley prohíbe que el comercio abra (salvo excepciones muy acotadas). El optimizador debe excluirlos del cálculo.

## Feriados irrenunciables en Chile

Según la Ley 19.973 y modificaciones posteriores:

1. **1 de enero** — Año Nuevo.
2. **1 de mayo** — Día Nacional del Trabajo.
3. **18 de septiembre** — Fiestas Patrias (Independencia Nacional).
4. **25 de diciembre** — Navidad.
5. **Día de elecciones presidenciales** (primera vuelta y segunda vuelta, en años electorales).

> El 19 de septiembre (Día de las Glorias del Ejército) es feriado nacional pero **no** irrenunciable en todo el retail, por lo cual por ahora no lo incluimos. Puede agregarse después si la empresa lo decide.

## Objetivo

1. Seed inicial con feriados de 2026 y 2027 cargados en `holidays`.
2. UI de admin para agregar manualmente feriados puntuales (ej: día de elecciones, que no es fijo).
3. Integración automática con el optimizador: los feriados que caen en el mes objetivo se envían en el payload.
4. UI del calendario marca visualmente los días feriado (badge 🔒).

## UI del admin

### `/admin/feriados`

```
┌────────────────────────────────────────────┐
│ Feriados irrenunciables                    │
│                           [+ Agregar]      │
├────────────────────────────────────────────┤
│ 2026-01-01  Año Nuevo              [x]     │
│ 2026-05-01  Día del Trabajador     [x]     │
│ 2026-09-18  Fiestas Patrias        [x]     │
│ 2026-12-25  Navidad                [x]     │
├────────────────────────────────────────────┤
│ 2027-01-01  Año Nuevo              [x]     │
│ ...                                        │
└────────────────────────────────────────────┘
```

## Payload al optimizador

El frontend, al armar el payload para un mes:

```ts
const holidaysInMonth = await listHolidays({ year, month })
payload.holidays = holidaysInMonth.map(h => h.fecha)  // ["2026-05-01"]
```

El backend, en `is_day_open(day)`, excluye cualquier día cuya fecha esté en `holidays`.

## Visualización en calendario

En el `DayCell` de la Spec 004:

```tsx
{isHoliday && (
  <Badge icon="🔒" tooltip={holidayName}>Feriado</Badge>
)}
```

Los slots en un día feriado no se pueden agregar (drop rechazado).

## Criterios de aceptación

- [ ] El seed crea los 4 feriados fijos de 2026 y 2027.
- [ ] Admin puede agregar un feriado puntual (ej: día de elecciones) desde la UI.
- [ ] El optimizador no asigna turnos en días feriados.
- [ ] El calendario marca los días feriado con badge.
- [ ] Si se intenta mover un turno a un día feriado, el drop se rechaza con mensaje.
