# F11 — Horario libre (jefes de sucursal y admins)

## Problema

Hoy la única forma de tener un calendario es generar uno rotativo desde una
categoría/patrón y editarlo a mano encima. Los jefes de sucursal quieren
poder **crear su horario mensual desde cero, de manera libre**, sin patrón
rotativo, pero cumpliendo las mismas reglas legales. Los meses varían en
cantidad de días y los horarios reales no siempre son replicables como
rotación — si una sucursal usa horario libre, simplemente no ocupa rotativo.

Además, el diagnóstico de Fase 0 (2026-07-04, producción) confirmó un bug
estructural de validación en el borde de mes — ver sección Fase 0.

## Decisiones cerradas (conversación 2026-07-04, no re-preguntar)

1. **Grupos incluidos desde v1.** La UI los muestra combinados (igual que la
   vista de grupo actual: trabajadores de todas las sucursales juntos,
   separados por área), pero cada equipo guarda su propio horario. Al
   guardar se divide por equipo (`splitCalendarByTeam` ya existe y hace
   exactamente esto).
2. **Sin rotación, sin réplica de mes.** No hay herramienta "copiar mes
   anterior". Cada mes libre parte en blanco.
3. **Turnos de horario libre** (cualquier inicio/fin) **pero acotados**:
   entrada ≥ 06:00, salida ≤ 22:00.
4. **Reglas legales** (bloquean el guardado):
   - Máximo 42 horas semanales (semana ISO lun-dom) — ya existe.
   - Máximo 6 días trabajados consecutivos — ya existe, pero DEBE
     considerar la cola real del mes anterior (ver Fase 0).
   - Al menos 2 domingos libres al mes, no consecutivos — ya existe.
   - **Máximo 10 horas trabajadas por turno** (descontada la colación, o
     sea extensión máxima 11h para turnos ≥6h) — **regla NUEVA**, no está
     en `validation.ts`. Se agrega a la lib compartida para que aplique a
     ambos modos (libre Y rotativo editado a mano).
   - Bloqueos de trabajadores (WorkerBlock) y feriados — ya existen.
5. **Días pasados**: nunca editables por supervisores (regla `lockedBefore`
   ya existente en CalendarView); **solo admins** pueden editar el pasado.
6. **Guardar incompleto está permitido, con advertencia.** Distinción
   importante: *incompletitud* (trabajadores sin turnos pintados, días sin
   cobertura) = warning que deja guardar tras confirmar; *violación legal*
   (las reglas del punto 4) = error que bloquea. Calendario totalmente
   vacío: botón guardar deshabilitado.
7. **Pestañas por sucursal/mes: "Horario rotativo" | "Horario libre".**
   - Solo puede haber UN horario guardado por equipo/mes (sigue siendo un
     único row de `Calendar`).
   - La pestaña del tipo actualmente guardado aparece primera y activa.
   - La otra pestaña es explorable libremente (todo en memoria, no persiste
     nada hasta Guardar).
   - Al guardar desde la pestaña del tipo contrario al guardado: diálogo de
     advertencia — "Ya tienes un horario rotativo guardado para julio. Si
     guardas, este horario libre pasará a ser el horario oficial y
     reemplazará al anterior. ¿Continuar?".
8. **Nombre de la pestaña**: "Horario libre" (confirmado).

## Fase 0 — Bug de borde de mes (datos reales, 2026-07-04)

**Causa raíz**: cada calendario se genera y valida solo contra su propia
grilla extendida. La primera semana de julio (29-jun → 5-jul) se rellena
desde el patrón/rotación al generar julio, **no desde lo que junio
realmente tiene guardado** (que pudo editarse a mano o cargarse desde
Excel). Ninguna de las dos validaciones ve la combinación real.

**Diagnóstico ejecutado en producción** (script de solo lectura,
combinando los días reales de cada mes desde su propio calendario):

- 243 trabajadores con calendario en junio Y julio 2026.
- **43 con violación** (racha >6 días consecutivos o >42h en la semana
  frontera 29-jun→5-jul).
- **15 con racha que CRUZA el borde de mes** (el gap estructural). Peor
  caso: 9 días seguidos (26-jun→4-jul) con 52h en la semana frontera.
- El resto son violaciones intra-mes: datos que entraron sin pasar por
  validación (cargas Excel directas a la BD, datos previos a que la
  validación fuera obligatoria). Peor caso: 13 días seguidos.

**Fix planificado** (lib compartida, beneficia a ambos modos):

- `validateCalendarForPublish` recibe un parámetro opcional
  `prevMonthShifts?: Record<workerId, Record<dateStr, DayShift | null>>`
  con los últimos ~7 días REALES del mes anterior por trabajador (leídos
  del `Calendar` guardado del mes anterior, resueltos vía sus assignments).
- La racha de días consecutivos se calcula sobre la concatenación
  cola-del-mes-anterior + mes actual.
- Las horas de la semana ISO frontera se calculan usando los días reales
  del mes anterior en vez de los días "extendidos" que trae la grilla del
  mes actual (que pueden no coincidir con lo realmente guardado).
- Los tres call sites que validan (CalendarView vía props, la page admin y
  la page supervisor que arman los datos) cargan el calendario del mes
  anterior — ya lo hacen para `prevAssignments`, así que la query extra es
  marginal (falta extraer también los slots, no solo assignments).
- **Corrección histórica**: los 43 casos existentes NO se corrigen
  automáticamente (son horarios ya publicados y en parte ya trabajados).
  Se entrega el listado a RRHH/usuario; los días futuros se pueden
  arreglar a mano con el editor. El fix evita que se generen casos nuevos.

## Arquitectura (de programador a programador)

### Storage: cero modelo nuevo

Un horario libre ES un `Calendar` normal (`slotsData` + `assignments`),
guardado por el `POST /api/calendars` existente. Con eso heredamos gratis:
export RRHH individual/grupo/masivo, F10 (historial + tracking de
descargas, vía `computeCalendarDiff` + `save-notify`), badges, bloqueos.
Ningún pipeline downstream cambia.

Única adición al schema:

```prisma
model Calendar {
  ...
  origen String? // "libre" | null (null = rotativo). Decide qué pestaña
                 // aparece activa y hace que "Regenerar" advierta antes
                 // de pisar un horario pintado a mano.
}
```

Requiere `db push` en producción (backup antes, como siempre).

### Editor: componente nuevo, NO tocar CalendarView.tsx

`CalendarView.tsx` (~1000 líneas, drag-and-drop en producción, sin tests de
UI) no se toca — mismo criterio por el que se difirió F10 fase 6. El editor
libre es una página/componente nuevo y más simple, porque en modo libre la
abstracción slot/assignment sobra: **fila = trabajador directamente**. Al
guardar se materializa como slot `i+1` → worker `i` (orden nombre asc,
mismo criterio del generador); el supervisor nunca ve "slots".

Estructura sugerida:

```
src/app/.../horario-libre/          (o integrado como pestaña en las pages existentes)
  FreeScheduleEditor.tsx            — grilla + estado + guardado
  FreeScheduleToolbar.tsx           — paleta de turnos + herramientas
src/lib/calendar/freeSchedule.ts    — lógica pura: aplicar pincel, copiar
                                      día/semana/fila, "todos los martes",
                                      materializar a slots. CON TESTS.
```

Reusar SIEMPRE que exista: `buildIsoWeeks`, `shiftDuration`,
`validateCalendarForPublish` (+ fix Fase 0), `CalendarValidationPanel`,
`splitCalendarByTeam`, `computeCalendarDiff`, `save-notify`. Las guardas
preventivas al pintar (impedir el 7º día consecutivo ANTES de pintarlo)
ya tienen lógica de referencia en
`src/app/supervisor/mis-horarios/PatternBuilderClient.tsx`
(`wouldExceedConsecutive`) — adaptar, no reinventar.

### UI del editor

Grilla mensual: filas = trabajadores activos (en grupo: de todos los
equipos, agrupados por área como la vista combinada actual), columnas =
días agrupados por semanas Lun-Dom.

**Pintar**: paleta de turnos arriba — presets rápidos + "turno
personalizado" (inicio/fin acotados 06:00-22:00, máx 10h trabajadas) +
"borrador" (libre). Click o click-arrastre para aplicar el pincel.
Click en celda individual → editar/limpiar.

**Herramientas de propagación**:

| Herramienta | Gesto |
|---|---|
| Copiar día → pegar en otros días | menú contextual en celda |
| "Todos los Martes con este horario" | menú en encabezado de columna |
| Copiar semana → pegar en semana(s) | botón en encabezado de semana |
| Repetir semana 1 en todo el mes | botón global |
| Copiar fila completa de otro trabajador | menú en la fila |
| Limpiar día / semana / fila | menú contextual |
| Deshacer (stack en memoria) | Ctrl+Z |

**Feedback en vivo**:
- Columna fija por fila: horas de la semana vs 42h (verde/rojo), domingos
  libres del mes, racha máxima (incluyendo cola del mes anterior).
- Validación live (debounced) con `CalendarValidationPanel`, celdas
  problemáticas marcadas.
- Guardas preventivas al pintar (7º día consecutivo, >10h, fuera de
  ventana horaria).

**Guardar**: `validateCalendarForPublish` con cola del mes anterior →
errores legales bloquean; incompletitud advierte y deja confirmar → si el
tipo guardado era distinto, advertencia de reemplazo → `POST
/api/calendars` con `origen: "libre"` → `save-notify` con diff → F10.

### Entradas

- **Supervisor** (`/supervisor/calendario`): pestañas Rotativo | Libre por
  bloque. Si el equipo no tiene categoría, la pestaña Libre es la
  alternativa natural al CategoryPicker.
- **Admin** (`/admin/sucursales/[id]/calendario/...`): mismas pestañas.
  Ojo con el redirect a grupo ya existente — la vista de grupo también
  necesita las pestañas.
- Acceso: mismos gates existentes (`allowedBranchIds`), sin políticas
  nuevas.

### Gotchas conocidos para quien implemente

- El guardado del supervisor pasa por `onSaveCalendar` (SupervisorCalendarView)
  y el del admin por fetch directo en CalendarView — el editor libre debe
  tener UN solo camino de guardado propio (no heredar esa duplicación), y
  actualizar su base de diff tras guardar (ver bug corregido 2026-07-03 en
  ambas vistas: commit `35d09db`).
- `esVirtual` y trabajadores inactivos: excluirlos igual que las vistas
  actuales (`activo: true, esVirtual: false` + filtro de supervisores por
  `supervisorLookupKey`).
- El botón "Regenerar" del modo rotativo debe advertir si `origen ===
  "libre"` antes de pisar.
- Validación de ventana horaria y 10h también en el servidor (el POST
  /api/calendars hoy confía en el cliente para las reglas) — al menos para
  los payloads con `origen: "libre"`; hardening completo es tema F8.
- Los tests de lógica pura van al lado del módulo (patrón del repo:
  `combineGroupTeams.test.ts`, `cambiosData.test.ts`). Vitest con
  `--poolOptions.threads.singleThread=true` en esta máquina.

## Fuera de alcance

- Pizarra de autoservicio para VENDEDORES (que cada vendedor arme su propio
  horario): sigue pospuesta, NO es F11. F11 es para jefes de sucursal y
  admins.
- Corrección automática de los 43 casos históricos del diagnóstico.
