# F11 Fase 5 — Paleta de bloques horarios arrastrables + pendientes

Estado al 2026-07-05: F11 v2 desplegado (modo libre sobre CalendarView real,
botón "Crea tu horario", 3 alcances en el diálogo, mensajes con nombre).
Esto especifica la siguiente iteración, pedida por el usuario.

## Paleta de bloques horarios (feature principal)

**Qué pidió el usuario:** al crear turnos, que se vayan guardando arriba los
"bloques horarios" usados (turnos únicos Y semanas completas de un
trabajador), para luego tomarlos y **arrastrarlos** a donde quiera.

**Diseño propuesto:**

1. Componente nuevo `ShiftPalette.tsx` (components/calendar), renderizado
   por CalendarView solo cuando recibe prop nueva `showShiftPalette`
   (la pasa FreeCalendarView; el rotativo no la muestra).
2. **Bloques de turno**: se derivan automáticamente de `localSlots` — cada
   `start–end` distinto usado en el mes es un chip (color estable por hash
   del string, reusar `worker-colors.ts`). Sin persistencia en DB: la
   paleta ES el reflejo de lo ya pintado. Chips `draggable` con
   `dataTransfer.setData("application/x-shift", JSON.stringify(shift))`.
3. **Bloques de semana**: por cada trabajador cuya semana (Lun-Dom) tenga
   ≥1 turno, la "forma" de esa semana (7 valores shift|null) es candidata;
   deduplicar formas idénticas. Chip con mini-preview (7 cuadritos
   coloreados). `dataTransfer` tipo `application/x-week`.
4. **Drop targets** (única cirugía en WeekBlock, mantener mínima):
   - Celda día: acepta `x-shift` → aplica ese turno a esa celda (mismo
     camino que handleShiftSave scope "week").
   - Celda nombre del trabajador (por semana): acepta `x-week` → aplica la
     forma completa a esa semana de ese trabajador (días del mes actual,
     respetando lockedBefore y bloqueos).
   - Los handlers de drop existentes usan estado interno (dragSource);
     los nuevos usan dataTransfer — no chocan, pero hay que chequear
     `e.dataTransfer.types` en dragOver para distinguir drag interno
     (mover turno) de drag desde paleta.
5. Todo pasa por `tryChangeGated` + `setDirty(true)` como el resto.

## Pendientes menores confirmados

- Copiar UN día (columna) a otros días arbitrarios — menú contextual celda.
- Guardas preventivas que impidan pintar la celda violatoria (hoy pinta y
  marca rojo al instante). Referencia: wouldExceedConsecutive.

## Hallazgos del check general (opinión, decidir con el usuario)

1. **DIVERGENCIA con el spec original**: al montar el modo libre sobre
   CalendarView se heredó su flujo "¿Guardar como versión incompleta?" —
   un supervisor puede confirmar y guardar CON errores legales (el spec
   F11 decía que lo legal bloquea; solo el >42h vigente bloquea duro).
   Decidir: ¿bloquear duro todos los errores legales en modo libre, o
   aceptar el confirm heredado? Recomiendo bloquear duro en libre (es
   creación desde cero, no hay excusa de datos históricos).
2. **Export de grupo desde la vista libre/rotativa combinada**: el botón
   "Exportar Excel" interno de CalendarView arma la URL con el PRIMER
   teamId — en grupos exporta solo esa sucursal. Preexistente (la vista
   supervisor tiene el mismo comportamiento), pero ahora más visible.
   Fix natural: cuando hay varios slices, apuntar a export-group.
3. **"Limpiar todo" en libre** no borra el calendario guardado (solo la
   vista, hasta Guardar) — correcto, pero el rotulo podría confundir con
   el "Limpiar" del rotativo que sí borra vía DELETE. Evaluar renombrar.
4. Los 43 casos históricos del diagnóstico Fase 0 siguen sin corregirse
   (decisión RRHH pendiente, Excel entregado en Downloads del usuario).
5. Tests: 3 fallas preexistentes en generator.test.ts (`ventas_mall_7d`
   fuera del catálogo estático) — llevan semanas así; o se arregla el
   catálogo o se ajusta el test, pero decidirlo de una vez.

## Verificación (cuando se implemente)

- Arrastrar bloque de turno a celda vacía y ocupada; a día pasado (no debe,
  salvo admin); a día con bloqueo (no debe).
- Arrastrar semana a otro trabajador y a la misma fila en otra semana.
- Guardar y verificar diff en F10 + export RRHH.
- Confirmar que el drag interno (mover turno entre días) sigue funcionando.
