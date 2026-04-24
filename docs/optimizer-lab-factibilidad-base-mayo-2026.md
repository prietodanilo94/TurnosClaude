# Optimizer Lab: factibilidad base mayo 2026

## Caso base

- Categoria: `ventas_mall_dominical`
- Solver: `cp_sat`
- Ano/mes: `2026-05`
- Horas semanales objetivo: `42`
- Maximo dias seguidos: `6`
- Domingos libres minimos: `2`
- Propuestas por corrida: `2`
- Time limit: `30s`

## Importante antes de interpretar

- Este barrido se ejecuto contra la API real `https://turnos3.dpmake.cl/api/optimizer-lab`.
- El laboratorio actual de `cp_sat` usa un catalogo fijo de turnos:
  - `APE` = 10:00 a 19:00
  - `CIE` = 11:00 a 20:00
  - `COM` = 10:00 a 20:00
- El payload actual fija `cobertura_minima = 2`.
- Por eso este barrido sirve para medir la factibilidad del laboratorio actual, no todavia para afirmar que ya exploramos "todas las combinaciones posibles" de turnos.

## Resultado por dotacion

| Dotacion | Factible | Propuestas | Diagnostico | Min coverage | Domingos libres min | 42h exactas | Max dias seguidos reales | Observacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | No | 0 | Sin solucion factible | - | - | - | - | No encuentra salida |
| 3 | No | 0 | Sin solucion factible | - | - | - | - | No encuentra salida |
| 4 | Si | 2 | OPTIMAL | 2 | 2 | Si | 9 | Factible formal, no usable por rachas |
| 5 | Si | 2 | OPTIMAL | 3 | 2 | Si | 9 | Factible formal, no usable por rachas |
| 6 | Si | 2 | OPTIMAL | 3 | 2 | Si | 7 | Cerca, pero sigue rompiendo regla dura |
| 7 | Si | 2 | OPTIMAL | 4 | 2 | Si | 9 | Mucha holgura, rachas siguen malas |
| 8 | Si | 2 | OPTIMAL | 4 | 2 | Si | 7 | Igual rompe dias seguidos |
| 9 | Si | 2 | OPTIMAL | 5 | 2 | Si | 7 | Igual rompe dias seguidos |
| 10 | Si | 2 | OPTIMAL | 6 | 2 | Si | 8 | Sube holgura, pero no corrige rachas |
| 11 | Si | 2 | OPTIMAL | 6 | 2 | Si | 9 | Mucha holgura, rachas muy malas |
| 12 | Si | 2 | OPTIMAL | 7 | 2 | Si | 8 | Mucha holgura, rachas siguen |

## Resultado por dotacion en heuristic

| Dotacion | Factible | Propuestas | Diagnostico | Min coverage | Domingos libres min | 42h exactas | Max dias seguidos reales | Observacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | No | 0 | Dotacion insuficiente | - | - | - | - | Sugiere minimo 4 slots |
| 3 | No | 0 | Dotacion insuficiente | - | - | - | - | Sugiere minimo 4 slots |
| 4 | Si | 2 | Factible heuristica | 2 | 2 | Si | 9 | Factible formal, no usable por rachas |
| 5 | Si | 2 | Factible heuristica | 2 | 3 | Si | 9 | Mejora domingos, no corrige rachas |
| 6 | Si | 2 | Factible heuristica | 2 | 3 | Si | 7 | Cerca, pero sigue rompiendo |
| 7 | Si | 2 | Factible heuristica | 2 | 3 | Si | 8 | Sigue con rachas largas |
| 8 | Si | 2 | Factible heuristica | 2 | 3 | Si | 8 | Sigue con rachas largas |
| 9 | Si | 2 | Factible heuristica | 2 | 3 | Si | 7 | Sigue con rachas largas |
| 10 | Si | 2 | Factible heuristica | 2 | 4 | Si | 7 | Mas domingos, rachas aun malas |
| 11 | Si | 2 | Factible heuristica | 2 | 4 | Si | 7 | Mas domingos, rachas aun malas |
| 12 | Si | 2 | Factible heuristica | 2 | 4 | Si | 7 | Mas domingos, rachas aun malas |

## Hallazgos base

1. Con el laboratorio actual, la factibilidad formal aparece desde `4` personas.
2. En todas las dotaciones factibles del barrido, la mejor propuesta encontrada rompe la regla real de `maximo 6 dias seguidos`.
3. Las `42 horas exactas por semana` si se cumplen de forma consistente en todos los slots y semanas.
4. Los `2 domingos libres al mes` tambien se cumplen de forma consistente en todos los slots.
5. El principal problema del laboratorio actual no es horas ni domingos; son las rachas de trabajo consecutivo.

## Comparacion cp_sat vs heuristic

1. Ambos modos encuentran factibilidad formal desde `4` personas.
2. Ambos modos incumplen la regla real de `maximo 6 dias seguidos` en todo el barrido `4..12`.
3. `cp_sat` tiende a sobredimensionar mas la cobertura:
   - con `cp_sat`, la cobertura minima sube desde `2` hasta `7` a medida que aumenta la dotacion.
   - con `heuristic`, la cobertura minima se mantiene en `2` en todo el barrido.
4. `heuristic` tiende a regalar mas domingos libres al subir la dotacion:
   - con `cp_sat`, el minimo se mantuvo en `2`.
   - con `heuristic`, subio a `3` y luego a `4` en dotaciones altas.
5. `heuristic` parece un poco menos agresivo en algunas rachas altas, pero no resuelve el problema de fondo. Sigue entregando maxima racha real `7`, `8` o `9`.
6. Con las reglas de negocio definidas como duras, hoy ninguno de los dos modos entrega una propuesta realmente usable.

## Conclusiones sobre combinaciones reales de turnos

### Duraciones actuales del laboratorio

- `APE`: 8 horas laborales
- `CIE`: 8 horas laborales
- `COM`: 9 horas laborales

### Que catálogos son imposibles por matematica pura

1. `Solo COM` es inviable para una regla de `42 horas exactas por semana`.
   - `4 x 9 = 36`
   - `5 x 9 = 45`
   - No existe combinacion semanal entera que sume `42`.

2. `Solo APE`
   - `5 x 8 = 40`
   - `6 x 8 = 48`
   - Tampoco puede llegar a `42`.

3. `Solo CIE`
   - Igual que `APE`, tampoco puede llegar a `42`.

4. `APE + CIE` sin `COM` tambien es inviable para `42` exactas.
   - Cualquier mezcla de turnos de `8` horas siempre suma multiplos de `8`, nunca `42`.

### Primer catalogo realmente viable

El primer catalogo que si permite `42 horas exactas` es:

- `APE + CIE + COM`

Con esas duraciones, la unica forma semanal de llegar a `42` es:

- `2 COM + 3 turnos cortos`

Los 3 turnos cortos pueden repartirse como:

- `3 APE`
- `2 APE + 1 CIE`
- `1 APE + 2 CIE`
- `3 CIE`

En todos los casos:

- `2 x 9 + 3 x 8 = 42`
- total de dias trabajados por semana = `5`
- total de libres por semana = `2`

### Implicancia de cobertura

Si la regla real de negocio es:

- "durante todo el horario 10:00 a 20:00 debe haber al menos 1 trabajador"

entonces la cobertura diaria se puede construir con:

- `1 COM`, o
- `1 APE + 1 CIE`, o
- una combinacion equivalente con mas personas

Esto es distinto del laboratorio actual, que fija `cobertura_minima = 2`.

### Por que el laboratorio actual sugiere minimo 4

En mayo 2026 hay `5` domingos visibles.

- Si cada trabajador debe tener `2` domingos libres, cada trabajador puede trabajar como maximo `3` domingos.
- Si el modelo exige `2` personas de cobertura dominical, se necesitan al menos `10` asignaciones dominicales.
- `10 / 3 = 3.33`, por lo tanto el piso matematico sube a `4` trabajadores.

Esto explica por que el `heuristic` hoy sugiere `minimumSuggested = 4`.

Pero si tu regla real fuera solo:

- `1 persona presente durante todo el horario`

entonces el piso teorico por domingos no seria `4`, sino `2`.

## Esqueletos semanales razonables para probar luego en OR-Tools

Como cada trabajador debe hacer exactamente `5` dias de trabajo y `2` libres por semana, un siguiente paso sano es restringir la busqueda a esqueletos semanales que no faciliten rachas largas entre una semana y otra.

Familia inicial razonable:

- `WWOWOWW`
- `WWOWWOW`
- `WOWWOWW`
- `WOWWWOW`
- `WWWOOWW`
- `WWWOWOW`

Donde:

- `W` = trabaja
- `O` = libre

Estos esqueletos reparten mejor los descansos dentro de la semana y son una base mas realista que concentrar siempre `5` trabajados seguidos.

## Primera biblioteca candidata para OR-Tools

### Patrones semanales candidatos

Pensando ya no solo en una semana aislada, sino en poder encadenar `5` semanas visibles con `2 domingos libres` y sin rachas largas, aparece una biblioteca inicial muy prometedora:

| Codigo | Patron | Libres | Domingo |
| --- | --- | --- | --- |
| A | `WOWWWOW` | martes, sabado | trabajado |
| B | `WWOWWOW` | miercoles, sabado | trabajado |
| C | `WWOWWWO` | miercoles, domingo | libre |
| D | `WWWOWWO` | jueves, domingo | libre |

Lectura:

- `A` y `B` son semanas con domingo trabajado.
- `C` y `D` son semanas con domingo libre.
- Las 4 respetan `5` dias trabajados y `2` libres.
- Las 4 son compatibles con la regla semanal de `2 COM + 3 cortos = 42h`.

### Primera rotacion mensual candidata

Ejemplo de rotacion de `5` semanas para un slot:

- `A | B | A | C | D`

Esto produce:

- `3` domingos trabajados
- `2` domingos libres
- racha maxima de trabajo `3` dias en las `5` semanas concatenadas

Otra rotacion equivalente:

- `A | A | B | C | D`

Tambien cumple:

- `3` domingos trabajados
- `2` domingos libres
- racha maxima de trabajo `3`

### Por que esta biblioteca es interesante

1. Nace alineada con la regla real de `2 domingos libres`.
2. Evita de entrada las semanas tipo `WWWWWOO`, que suelen disparar rachas mas largas al pasar de una semana a otra.
3. Permite que OR-Tools optimice sobre una biblioteca mas sana y realista, en vez de dejarle total libertad para construir semanas operativamente feas.
4. Sigue dejando espacio para variar que dias cortos son `APE` o `CIE`, siempre que la semana cierre en `2 COM + 3 cortos`.

### Como usarla en el siguiente experimento

El siguiente experimento serio de OR-Tools deberia modelar:

- biblioteca de patrones de trabajo/libre = `A, B, C, D`
- mezcla semanal por slot = `2 COM + 3 cortos`
- domingos libres minimos por slot = `2`
- dias consecutivos maximos = `6`

Y dejar como margen de optimizacion:

- que cortos son `APE` o `CIE`
- en que semanas usar `A` o `B`
- en que semanas usar `C` o `D`
- como repartir estos patrones entre los distintos slots de la dotacion

## Ejemplos de violaciones detectadas

- Dotacion `4`:
  - `T2`: 9 dias seguidos, del `2026-05-21` al `2026-05-29`
  - `T4`: 9 dias seguidos, del `2026-04-30` al `2026-05-08`
- Dotacion `6`:
  - `T2`: 7 dias seguidos, del `2026-05-23` al `2026-05-29`
  - `T5`: 7 dias seguidos, del `2026-05-09` al `2026-05-15`
- Dotacion `8`:
  - `T1`: 7 dias seguidos, del `2026-05-13` al `2026-05-19`
  - `T6`: 7 dias seguidos, del `2026-05-09` al `2026-05-15`
  - `T7`: 7 dias seguidos, del `2026-05-02` al `2026-05-08`

## Lectura operativa

- Si la regla de `6 dias seguidos` es rigida, hoy no deberiamos considerar "usable" ninguna de las mejores propuestas del barrido base.
- El score actual del solver no esta penalizando de forma suficiente una grilla que, en la practica, seria dificil o incorrecta de operar.
- La holgura adicional de dotacion no esta corrigiendo por si sola el problema. Con mas gente sube la cobertura minima, pero no desaparecen las rachas largas.
- En el estado actual del laboratorio, `cp_sat` sirve mejor para tensionar factibilidad y ver la estructura del modelo exacto; `heuristic` sirve mejor como referencia comparativa rapida, pero no como solucion final confiable.
- Para pasar a "combinaciones reales" de horario, el siguiente salto ya no es solo correr mas barridos: hay que ampliar o redefinir el catalogo de turnos y verificar que las restricciones rigidas queden realmente integradas al modelo exacto.

## Siguientes pruebas sugeridas

1. Probar `cp_sat` con un catalogo controlado de combinaciones reales de turnos, por ejemplo:
   - solo `COM`
   - `APE + CIE`
   - `APE + CIE + COM`
2. Revisar y ajustar el modelo de `cp_sat` para que la restriccion de `maximo 6 dias seguidos` quede verdaderamente amarrada en la solucion final antes de comparar calidad fina entre combinaciones.
