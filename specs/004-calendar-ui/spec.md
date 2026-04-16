# Spec 004 — Calendario Dinámico

## Contexto

Una vez generadas las propuestas, el admin o jefe de sucursal necesita visualizarlas y ajustarlas en un calendario mensual. Esta es la feature más visible del sistema.

## Objetivo

Un calendario mensual interactivo donde:
1. Se visualizan todos los slots de turno del mes, separados por día.
2. Cada slot muestra (en modo sin asignar) "Trabajador 1", "Trabajador 2", etc., y el rango horario.
3. Al clickear un slot, se puede asignarle un trabajador real de la dotación.
4. Se pueden arrastrar turnos entre días (drag & drop) y el sistema revalida en vivo.
5. Cada semana tiene un contador de horas por trabajador.
6. Las violaciones de restricciones se marcan en rojo con tooltip explicativo.
7. Los solapamientos entre trabajadores el mismo día son visibles.

## Componentes

### Vista principal

```
┌──────────────────────────────────────────────────────────────────┐
│ Sucursal: NISSAN IRARRAZAVAL (AutoPark)  │  Mayo 2026            │
│ Propuesta: ILP #1 (score 98.7)  [▼ cambiar propuesta]            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Sem 1 │ Lun 4 │ Mar 5 │ Mié 6 │ Jue 7 │ Vie 8 │ Sáb 9 │ — │     │
│       │ T1    │ T1    │ T1    │ T1    │ T1    │ T1    │   │     │
│       │09-19  │09-19  │09-19  │09-19  │09-19  │09-19  │   │     │
│       │ T2    │ T2    │       │ T2    │ T2    │ T2    │   │     │
│       │10-20  │10-20  │       │10-20  │10-20  │10-20  │   │     │
│       │                                                   │     │
│ Horas semana: T1 = 40h ✓  T2 = 50h ⚠ (excede 42h)                │
├──────────────────────────────────────────────────────────────────┤
│ Sem 2 │ ...                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Elementos visuales

- **Slots**: cajitas con turno. Color por trabajador (consistente en todo el mes).
- **Drag handle**: arrastrable entre celdas del mismo mes. Al soltar, se revalida.
- **Solapamiento visual**: si dos slots coinciden en el tiempo el mismo día, se muestran apilados con barra horizontal indicando el rango exacto.
- **Contador por semana**: al costado de cada semana, un bloque con las horas de cada trabajador. Verde si ≤ 42, amarillo si entre 40-42 (ok pero al tope), rojo si > 42.
- **Badges de día**:
  - `🔒` si es feriado irrenunciable.
  - `✳️` si es fin de semana.
  - `☂️` si algún trabajador está de vacaciones ese día.

### Panel lateral

- Selector de propuesta (si hay múltiples).
- Trabajadores disponibles con su resumen mensual de horas.
- Botón "Validar" (llama a `POST /validate`).
- Botón "Exportar Excel" (solo habilitado si no hay violaciones).
- Checkbox "Solo mi vista" (para jefes con varias sucursales, filtra).

### Asignación de trabajadores a slots

- Slot sin asignar: fondo gris, label "Trabajador N".
- Click en slot → dropdown con lista de trabajadores disponibles.
- Al asignar, el slot toma el color del trabajador.
- Si un trabajador ya está asignado a otro slot del mismo día con solape horario real, alertar.

## Tecnología

- **FullCalendar v6+** con plugin `@fullcalendar/timegrid` (vista `dayGridMonth` custom, o `timeGridWeek` por semana navegable).
- **dnd-kit** para drag & drop si FullCalendar no da suficiente control.
- **Zustand** para estado del calendario en cliente (la propuesta completa se guarda en memoria y se persiste con botón "Guardar").
- **Validación en vivo**: cálculo de horas por semana se hace client-side con función pura en TS (espeja la lógica de backend).

## Criterios de aceptación

- [ ] Carga una propuesta de 30+ asignaciones en < 500 ms.
- [ ] Drag & drop entre días funciona y revalida.
- [ ] El contador de horas actualiza en vivo al mover/asignar.
- [ ] Los slots con solape visual se ven claramente.
- [ ] Las violaciones se marcan en rojo con tooltip.
- [ ] El botón "Exportar" está deshabilitado si hay violaciones.
- [ ] Responsive mínimo: usable en laptop 13" (no requerimos mobile para MVP).
