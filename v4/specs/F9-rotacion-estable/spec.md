# F9 — Rotación estable por trabajador entre meses

## Problema

`generateCalendar` calcula qué semana de la rotación le toca a cada slot con:

```js
weekIdx = (isoWeek + slotNumber - 1) % rotLen
```

`slotNumber` no es una identidad estable del trabajador — se recalcula desde
cero cada vez que se genera/regenera un calendario, en orden alfabético de
los trabajadores **activos en ese momento**. Si la nómina cambia entre dos
generaciones (alguien entra, sale, o se reactiva), el mismo trabajador puede
quedar en un slot distinto, y por lo tanto le toca una semana de rotación
distinta — incluso para la **misma fecha calendario**.

Esto es invisible la mayor parte del tiempo (cada mes se genera y valida por
separado), pero se vuelve visible en la semana que cruza de un mes a otro,
porque esa semana existe en los datos guardados de **ambos** meses (ver F8/
fix de `validation.ts` para el detalle de por qué `slot.days` incluye esos
días). Si el trabajador cambió de slot entre la generación de junio y la de
julio, la vista de junio y la vista de julio muestran turnos distintos para
la misma semana física — y por lo tanto la cuenta de horas semanales
(tope legal 42h) no coincide entre ambas.

## Alcance medido en producción (2026-07-01)

De 58 equipos con calendario en junio y julio simultáneamente:
**36 equipos (62%) tienen al menos un trabajador que cambió de slot entre
los dos meses.**

No es un caso aislado de una sucursal — es sistémico, afecta a cualquier
equipo cuya nómina activa haya cambiado (entradas, salidas, reactivaciones)
entre la generación de un mes y la del siguiente.

## Intento existente (parcialmente implementado, y también incorrecto)

`SupervisorCalendarView.tsx` ya tiene un mecanismo de "continuar desde el
mes anterior" (`prevAssignments`), pero copia por **número de slot**, no por
**identidad del trabajador**:

```js
generated.slots.forEach((s) => {
  nextAssignments[String(s.slotNumber)] = prevAssignments[String(s.slotNumber)] ?? null;
});
```

Esto solo "funciona" cuando la nómina no cambió entre meses (en cuyo caso el
orden alfabético tampoco cambió) — exactamente el caso en que el bug no
existiría de todas formas. No resuelve nada cuando la nómina sí cambió.

## Objetivo del fix

Que un trabajador que sigue activo entre dos generaciones consecutivas
mantenga el mismo comportamiento de rotación para las fechas que se repiten
entre ambos calendarios — sin importar cuántas personas entraron o salieron
del equipo en el medio.

## Diseño propuesto

**Opción A — Ancla de rotación persistente por trabajador (recomendada)**

Agregar un campo a `Worker` (ej. `rotationAnchor: Int?`) que se fija **una
sola vez**, cuando el trabajador recibe su primer slot en un equipo, y no
se recalcula nunca mientras siga activo ahí. La fórmula de rotación pasa a
depender de ese ancla en vez de `slotNumber`:

```js
weekIdx = pattern.fixedSlots
  ? worker.rotationAnchor % rotLen
  : rotLen === 1 ? 0
  : (isoWeek + worker.rotationAnchor) % rotLen
```

- `slotNumber` sigue existiendo (para el layout de la tabla y el mapeo en
  `assignments`), pero deja de influir en qué semana de rotación le toca a
  cada quien.
- Al asignar un trabajador nuevo, `rotationAnchor` se fija según el primer
  slot disponible en ese momento (comportamiento actual, pero congelado).
- Si dos trabajadores del mismo equipo llegan a tener el mismo `rotationAnchor`
  (ej. por reasignación manual), no es un error — simplemente ambos
  comparten la semana de rotación, igual que hoy comparten `slotNumber`.

Requiere: migración de schema (`db push`), backfill de `rotationAnchor` para
trabajadores existentes (usando su `slotNumber` actual como valor inicial,
para no romper los calendarios ya generados), y actualizar `generateCalendar`
+ todos los call sites que hacen auto-asignación (`buildSoloBlock`,
`buildGroupBlock`, `backfill-missing/route.ts`, el `onRecalculateCalendar`
de `SupervisorCalendarView.tsx`).

**Opción B — Copiar por identidad, no por slot, al continuar desde el mes anterior**

Cambio más acotado: en vez de anclar la rotación de forma persistente, arreglar
el mecanismo de continuidad existente (`prevAssignments`) para que use
`workerId` como clave de correlación, no `slotNumber`:

```js
function assignWithContinuity(currentWorkerIds, prevAssignments) {
  const prevSlotByWorker = new Map();
  for (const [slot, workerId] of Object.entries(prevAssignments ?? {})) {
    if (workerId) prevSlotByWorker.set(workerId, Number(slot));
  }
  // ...trabajadores que ya tenian slot antes lo conservan; los nuevos
  // toman los slots libres restantes, en orden alfabetico.
}
```

Más simple de implementar (sin cambio de schema), pero con una limitación:
si un trabajador que estaba en el medio de la lista se desactiva, los que
venían después de él en la generación anterior sí pueden cambiar de slot
igualmente (el hueco se "cierra"). Resuelve el caso más común (agregar/quitar
al final de la lista) pero no garantiza estabilidad perfecta en todos los
casos, a diferencia de la Opción A.

## Recomendación

Implementar Opción A. Es más trabajo inicial (schema + backfill), pero es la
única que garantiza estabilidad real independiente de cómo cambie la nómina.
La Opción B seguiría produciendo el mismo bug en escenarios menos comunes
pero reales (alguien se va de la mitad de la lista).

## Fuera de alcance de este spec

- Corregir los calendarios YA generados con datos inconsistentes (requiere
  una decisión operativa: ¿se recalculan? ¿se dejan como estaban y solo se
  corrige hacia adelante? Discutir con el usuario antes de tocar datos
  históricos).
- El caso del trabajador eliminado por completo (hard delete) dejando una
  referencia huérfana en `assignments` — es un problema de integridad
  referencial aparte, no de rotación. Podría abordarse con un chequeo en
  `/admin/datos` (ver F7) que detecte `workerId`s en calendarios que ya no
  existen en `Worker`.
