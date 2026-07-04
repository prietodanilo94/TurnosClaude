# F11 — Tasks

Leer spec.md primero. Decisiones ya cerradas con el usuario — no re-preguntar.
Convención de commits: `v4/feat(horario-libre): ...` / `v4/fix(calendar): ...`.

## Fase 0: Bug de borde de mes (independiente del editor, afecta producción hoy)

- [x] Diagnóstico en producción (2026-07-04): 243 trabajadores jun+jul, 43
      con violación, 15 con racha cruzando el borde. Script:
      combinación de días reales de cada mes desde su propio Calendar.
- [x] `validateCalendarForPublish`: parámetro opcional `prevMonthShifts`
      (workerId → dateStr → DayShift|null, últimos ~7 días reales del mes
      anterior). Racha consecutiva y horas de la semana ISO frontera se
      calculan con esos días reales en vez de la grilla extendida propia
      (`effectiveDays`). Nueva lib pura `prevMonthTail.ts`
      (extractPrevMonthTail + mergePrevMonthTails) con tests.
- [x] Cargar la cola del mes anterior en los call sites: admin page (ya
      tenía el row completo del mes anterior) y supervisor page (se agregó
      `slotsData` al select de prevCalendars; en grupos se unen las colas
      de todos los equipos). Prop `prevMonthShifts` en CalendarView y
      SupervisorCalendarView.
- [x] Tests unitarios: racha 6+4 cruzando borde = 10 (error), horas
      frontera con datos reales vs asumidos por la grilla (en ambos
      sentidos: violación nueva detectada Y falso positivo eliminado),
      comportamiento sin cola idéntico al histórico.
- [x] **Decisión de diseño adicional** (2026-07-04): una semana >42h que ya
      terminó por completo (parámetro `todayStr`) se reporta como error
      pero NO activa el bloqueo duro `exceeds42hLimit` — de lo contrario
      los ~13 calendarios de julio ya afectados quedarían inguardables el
      resto del mes (la semana pasada no se puede corregir). El error sigue
      visible en el panel y el flujo "Guardar versión incompleta" sigue
      exigiendo confirmación explícita.
- [x] Listado de los 43 casos existentes entregado al usuario en la sesión
      del diagnóstico (2026-07-04) — corrección histórica es decisión de
      RRHH, no automática.

## Fase 1: Reglas nuevas en la lib compartida

- [ ] `shift_too_long` en `validation.ts`: error si un turno supera 10h
      trabajadas (shiftDuration, ya descuenta colación). Aplica a ambos modos.
- [ ] `shift_out_of_window` (o validación en el editor): inicio < 06:00 o
      fin > 22:00. En el editor libre los pickers ya lo impiden; la
      validación lo cubre para el modo rotativo editado a mano.
- [ ] Tests de ambas reglas.
- [ ] Verificar que los patrones rotativos existentes del catálogo no
      disparan falsos positivos (ninguno debería tener turnos >10h, pero
      confirmar antes de desplegar — si alguno lo hace, es hallazgo real).

## Fase 2: Editor libre mínimo + pestañas

- [ ] Columna `Calendar.origen String?` en schema + prisma generate + (tras
      deploy) db push en pompeyo con backup.
- [ ] `src/lib/calendar/freeSchedule.ts`: estado del editor (workerId →
      dateStr → DayShift|null), materialización a slots/assignments (orden
      nombre asc), aplicación de pincel. Tests.
- [ ] `FreeScheduleEditor.tsx`: grilla filas=trabajadores (individual y
      grupo combinado por área), pintar celda a celda, presets + turno
      personalizado (06:00-22:00, ≤10h trabajadas), días pasados
      bloqueados para supervisor (admin edita todo).
- [ ] Guardado único: validar (con cola de mes anterior) → errores
      bloquean / incompletitud advierte → advertencia de reemplazo de tipo
      si `origen` guardado difiere → POST /api/calendars con
      `origen: "libre"` (split por equipo en grupos) → save-notify con
      diff → actualizar base de diff local tras guardar.
- [ ] Pestañas "Horario rotativo" | "Horario libre" en la vista supervisor
      y admin: la del tipo guardado primera y activa, la otra explorable
      en memoria.
- [ ] "Regenerar" del modo rotativo advierte si origen === "libre".
- [ ] Botón guardar deshabilitado con calendario totalmente vacío.

## Fase 3: Herramientas de propagación

- [ ] Copiar día → pegar en otros días.
- [ ] "Todos los [día de semana] con este horario" (encabezado de columna).
- [ ] Copiar semana → pegar en otra(s) semana(s) + repetir semana 1 en todo el mes.
- [ ] Copiar fila completa de otro trabajador.
- [ ] Limpiar día / semana / fila.
- [ ] Deshacer (Ctrl+Z, stack en memoria).
- [ ] Toda la lógica de propagación en freeSchedule.ts con tests (las
      herramientas son funciones puras sobre el estado del editor).

## Fase 4: Feedback en vivo

- [ ] Contadores por fila: horas semana actual vs 42h, domingos libres del
      mes, racha máxima (incluyendo cola del mes anterior).
- [ ] Validación live (debounced) con CalendarValidationPanel + celdas
      problemáticas marcadas.
- [ ] Guardas preventivas al pintar: 7º día consecutivo, >10h, fuera de
      ventana (referencia: wouldExceedConsecutive de PatternBuilderClient).

## Validación final (usuario, con datos reales)

- [ ] Usuario crea un horario libre real en una sucursal individual.
- [ ] Usuario crea un horario libre real en un grupo.
- [ ] Verificar export RRHH y aparición en F10 de esos guardados.

## Fuera de alcance (NO hacer en esta entrega)

- Pizarra de autoservicio para vendedores.
- Corrección automática de los 43 casos históricos.
