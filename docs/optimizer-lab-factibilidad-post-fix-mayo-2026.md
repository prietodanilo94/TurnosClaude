# Optimizer Lab: factibilidad post-fix mayo 2026

## Caso base

- Categoria: `ventas_mall_dominical`
- Solver: `cp_sat`
- Ano/mes: `2026-05`
- Horas semanales objetivo: `42`
- Maximo dias seguidos: `6`
- Domingos libres minimos: `2`
- Propuestas por corrida: `2`
- Time limit: `30s`

## Que cambio respecto al baseline

El solver tenia un bug en la restriccion de dias consecutivos: sumaba dias por semana ISO (`sum_dias_semana <= 6`) en lugar de usar una ventana deslizante real. Eso permitia rachas de 7-9 dias cuando el dia libre cambiaba entre dos semanas consecutivas.

**Fix aplicado**: `v2/backend/app/optimizer/ilp.py`, funcion `_add_consecutive_constraints()`.

Para cada trabajador y cada ventana de `(dias_max + 1)` dias calendario, se agrego la restriccion CP-SAT:

```
sum(worked_vars_in_window) <= dias_max
```

Si hay asignaciones fijas del contexto parcial fuera del rango, se descuentan del presupuesto.

El mismo bug existia en el motor heuristico de `v3` (`engine.ts`): seleccionaba patrones semanales de forma independiente sin validar la racha entre semanas. Fix aplicado: post-build validation que rechaza el intento si cualquier slot supera `maxConsecutiveDays` y reintenta con semilla distinta.

## Resultado post-fix — cp_sat

Barrido ejecutado contra `https://turnos3.dpmake.cl/api/optimizer-lab` (que llama al optimizer de v2).

| Dotacion | Factible | Propuestas | Max dias seguidos | Cumple <= 6 | Estado |
| --- | --- | --- | --- | --- | --- |
| 2 | No | 0 | - | - | Infactible |
| 3 | No | 0 | - | - | Infactible |
| 4 | Si | 2 | 6 | Si | OK |
| 5 | Si | 2 | 6 | Si | OK |
| 6 | Si | 2 | 6 | Si | OK |
| 7 | Si | 2 | 6 | Si | OK |
| 8 | Si | 2 | 6 | Si | OK |
| 9 | Si | 2 | 6 | Si | OK |
| 10 | Si | 2 | 6 | Si | OK |
| 11 | Si | 2 | 6 | Si | OK |
| 12 | Si | 2 | 6 | Si | OK |

## Comparacion directa con el baseline

| Dotacion | Max consec (antes) | Max consec (despues) | Violacion antes | Violacion despues |
| --- | --- | --- | --- | --- |
| 4 | 9 | 6 | Si | No |
| 5 | 9 | 6 | Si | No |
| 6 | 7 | 6 | Si | No |
| 7 | 9 | 6 | Si | No |
| 8 | 7 | 6 | Si | No |
| 9 | 7 | 6 | Si | No |
| 10 | 8 | 6 | Si | No |
| 11 | 9 | 6 | Si | No |
| 12 | 8 | 6 | Si | No |

Reduccion promedio de dias de racha: del rango `7-9` al tope exacto `6`.

## Validacion de tests

```
v2/backend/tests/test_optimizer_vm7.py — 7 passed in 1.33s

  test_vm7_exactamente_42h_semana_completa           PASSED
  test_vm7_infactible_dotacion_insuficiente          PASSED
  test_vm7_domingos_libres                           PASSED
  test_vm7_balance_ape_cie                           PASSED
  test_non_vm7_sin_restriccion_5_dias                PASSED
  test_vm7_vacaciones_respetadas                     PASSED
  test_vm7_consecutivos_cruce_semanas                PASSED  ← test nuevo
```

El test `test_vm7_consecutivos_cruce_semanas` construye 3 semanas (21 dias), 4 trabajadores, `dias_max=5`, y verifica que ninguna racha supera `5` dias en la ventana deslizante global, incluyendo el cruce entre semanas ISO.

```
v3/frontend — vitest engine.test.ts — 4 passed

  diagnostica insuficiencia cuando la dotacion no alcanza     PASSED
  genera propuestas factibles con 42h exactas                 PASSED
  ninguna propuesta tiene racha superior al limite            PASSED  ← test nuevo
  rechaza configuraciones que dejan todos los domingos libres PASSED
```

## Hallazgos post-fix

1. La restriccion dura de `6 dias seguidos maximos` ahora queda realmente integrada al modelo CP-SAT. No hay forma matematicamente posible de que el solver entregue una racha mayor.

2. La factibilidad real aparece desde `4` trabajadores para el caso `ventas_mall_dominical` con mayo 2026 (`5 domingos visibles`, `cobertura_minima = 2`, `2 domingos libres por slot`).

3. Con `4` trabajadores la factibilidad es ajustada (zero margin en domingos: `4 × 2 = 8 slots maximos`, `5 domingos × 2 minimos = 10 necesarios`, el solver ajusta usando domingos adicionales con cargo a dias no consecutivos). La solucion es matematicamente valida pero sin margen operativo.

4. Desde `6` trabajadores hay margen real (+2 slots dominicales por tipo) y las propuestas son operativamente solidas.

5. El motor heuristico de `v3` tambien quedo corregido. Si el solver exacto no esta disponible, la heuristica tampoco entregara rachas largas.

## Lectura operativa

- Hoy cualquier propuesta generada por `cp_sat` para `ventas_mall_dominical` es usable desde el punto de vista de dias consecutivos.
- La restriccion de `42h exactas por semana extendida` se sigue cumpliendo en todas las dotaciones factibles.
- La restriccion de `2 domingos libres minimos por slot` se sigue cumpliendo.
- El diagnostico de factibilidad continua siendo correcto: sugiere `minimo 4` cuando la dotacion es insuficiente.

## Siguientes experimentos sugeridos

1. Ampliar el barrido a `minFreeSundays: 1` para ver si la factibilidad baja a `3` trabajadores.
2. Probar `cobertura_minima = 1` (un trabajador durante todo el horario en vez de dos) para ver el nuevo piso.
3. Validar el mismo fix en modo `heuristic` con el barrido completo `4..12` para comparar calidad relativa de propuestas entre ambos modos una vez que ambos cumplen las restricciones duras.
4. Extender el catalogo de turnos del laboratorio a combinaciones reales distintas (`solo APE+CIE` sin `COM`) y verificar que el solver diagnostica correctamente la infactibilidad para `42h` exactas.
