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

## Fase 1: Reglas nuevas en la lib compartida — COMPLETO (2026-07-04)

- [x] `shift_too_long` en `validation.ts`: error si un turno supera 10h
      trabajadas (shiftDuration, ya descuenta colación). Aplica a ambos modos.
- [x] `shift_out_of_window`: inicio < 06:00 o fin > 22:00. Constantes
      exportadas (MAX_SHIFT_WORKED_HOURS, SHIFT_WINDOW_*) que el editor
      libre reutiliza en sus pickers.
- [x] Tests de ambas reglas (incluye bordes exactos 06:00/22:00/10h y que
      la grilla extendida de otros meses no dispara).
- [x] Auditoría en producción antes de desplegar: 0 turnos existentes
      (jun/jul) y 0 de los 37 ShiftPatterns violan las reglas — sin falsos
      positivos.

## Fase 2: Editor libre mínimo + pestañas — COMPLETO (2026-07-04)

- [x] Columna `Calendar.origen String?` en schema + prisma generate. El
      POST /api/calendars acepta `origen` y el último guardado define el
      tipo (rotativo sin campo → null). db push en pompeyo tras el deploy.
- [x] `src/lib/calendar/freeSchedule.ts`: estado (workerId → dateStr →
      DayShift, ausencia = libre), materialización a slots/assignments,
      herramientas puras, métricas por fila y diff para save-notify.
      13 tests.
- [x] `FreeScheduleEditor.tsx` (components/calendar): grilla
      filas=trabajadores, individual y grupo combinado (etiqueta de
      sucursal por fila en grupos), pintar con click y arrastre, presets +
      turno personalizado acotado (06:00-22:00, ≤10h trabajadas con aviso
      inline), días pasados bloqueados para supervisor, feriados
      irrenunciables y días con WorkerBlock no pintables.
- [x] Guardado único: valida con cola del mes anterior → errores legales
      bloquean (con la excepción de semanas >42h ya transcurridas, vía
      exceeds42hLimit) / incompletitud (trabajadores sin turnos) advierte →
      advertencia de reemplazo si el guardado era rotativo → POST por
      equipo con `origen: "libre"` → save-notify con diff → baseline local
      actualizado (lección del bug 35d09db).
- [x] `CalendarTabs.tsx`: pestañas Rotativo | Libre en la vista supervisor
      (por bloque, incluye grupos) y en la vista admin. La del tipo
      guardado va primera, activa y con badge "oficial"; ambas quedan
      montadas (la inactiva oculta) para no perder trabajo al explorar.
- [x] "Regenerar" advierte si origen === "libre" (admin,
      recalculateConfirmMessage) y guardar desde la pestaña rotativa sobre
      un horario libre también advierte (saveConfirmMessage en ambas vistas).
- [x] Botón guardar deshabilitado con 0 turnos pintados.
- [x] La página admin ahora muestra las pestañas incluso si el equipo no
      tiene categoría (el horario libre es la alternativa natural).

## Fase 3: Herramientas de propagación — COMPLETO salvo un ítem (2026-07-04)

- [x] "Aplicar pincel a todos los [día de semana]" (cubre "todos los
      martes con este horario") — botones Lun..Dom en la toolbar.
- [x] Copiar semana anterior → esta semana (botón por semana) + repetir
      semana 1 en todo el mes.
- [x] Copiar fila completa de otro trabajador (dropdown en la fila).
- [x] Limpiar semana / limpiar fila / pincel borrador.
- [x] Deshacer (Ctrl+Z + botón, stack de 50 en memoria).
- [x] Lógica de propagación pura en freeSchedule.ts con tests.
- [ ] "Copiar UN día → pegar en otros días arbitrarios" (menú contextual
      por celda) — no implementado; el pincel + aplicar-a-día-de-semana
      cubren el caso principal. Evaluar con feedback real del usuario.

## Fase 4: Feedback en vivo — COMPLETO salvo un ítem (2026-07-04)

- [x] Contadores por fila: horas por semana vs 42h (columna Hrs por semana,
      rojo si excede, usa la cola real del mes anterior en la semana
      frontera), racha máxima y domingos libres (chips bajo el nombre,
      rojos si violan).
- [x] Validación live (useMemo, sin debounce — el volumen es trivial) con
      CalendarValidationPanel + celdas problemáticas marcadas en rojo.
- [ ] Guardas preventivas que IMPIDAN pintar la celda violatoria (estilo
      wouldExceedConsecutive de PatternBuilderClient) — no implementado:
      hoy se puede pintar y el feedback es inmediato (chip de racha, panel,
      celda roja) pero no se bloquea el gesto. Evaluar si hace falta.

## Validación final (usuario, con datos reales)

- [ ] Usuario crea un horario libre real en una sucursal individual.
- [ ] Usuario crea un horario libre real en un grupo.
- [ ] Verificar export RRHH y aparición en F10 de esos guardados.

## Fuera de alcance (NO hacer en esta entrega)

- Pizarra de autoservicio para vendedores.
- Corrección automática de los 43 casos históricos.
