# Spec 010 - Analizador de factibilidad visual v2

## Contexto

La investigacion de `docs/factibilidad-wiki.html` y `docs/mall-turnos-analisis-completo.md`
concluye que el problema no es solo "si existe cobertura", sino si el patron mensual
permite:

1. cubrir APE + CIE todos los dias,
2. respetar maximo 2 domingos trabajados por persona,
3. evitar rachas mayores a 6 dias seguidos en ventana deslizante real,
4. comparar opciones que sean entendibles para trabajadores y jefatura.

Negocio pidio una vista visual donde se pueda:

- ver las mejores opciones por numero de personas,
- comparar esquemas fijos versus rotativos,
- mover los dias libres para probar escenarios,
- detectar rapido cuando un cambio rompe la regla de 6 dias,
- usar la herramienta como apoyo de analisis, no solo como documento estatico.

## Objetivo

Crear una ruta de admin `/admin/factibilidad` que funcione como laboratorio visual
de patrones APE/CIE para sucursales Mall 7 dias.

La herramienta debe permitir iterar sobre un ciclo base de 4 semanas y recalcular en vivo:

- cobertura diaria minima,
- domingos trabajados por trabajador,
- racha maxima de dias consecutivos,
- alertas puntuales por trabajador o por dia.

## Alcance de esta spec

### Incluye

- Ruta dedicada en frontend admin.
- Selector de dotacion `N=4..12`.
- Comparacion entre opcion fija y opcion rotativa.
- Grilla semanal editable por clic para mover libres.
- Analizador local con lectura viva de:
  - APE presentes
  - CIE presentes
  - total presentes
  - domingos trabajados
  - maximo consecutivo por trabajador
- Correccion del validador local para medir consecutivos por racha real, no por semana ISO.
- Tests unitarios del motor del analizador.

### No incluye

- Persistencia de escenarios creados por el usuario.
- Integracion con Appwrite o sucursales reales.
- Generacion de calendario mensual real por branch.
- Esquema mixto `COM + APE/CIE` con turno corto de ajuste.
- Exportacion desde esta vista.

## Estado actual

Esta spec ya tiene una primera entrega implementada:

- Ruta `/admin/factibilidad` disponible.
- Menu admin enlazado a la nueva vista.
- Motor de analisis separado en `src/lib/factibilidad/`.
- Edicion por clic de libres semana a semana.
- Panel de alertas y resumen por trabajador.
- Correccion de consecutivos en `local-validator.ts` usando ventana real.

La vista actual se debe leer como un laboratorio de analisis y no como
la fuente final de un calendario mensual operativo.

## Reglas funcionales

### 1. Unidad de comparacion

La comparacion base es un ciclo de 4 semanas.

La herramienta puede usar contexto sintetico para analizar el patron, pero visualmente
debe presentar 4 semanas entendibles para el usuario.

### 2. Regla de cobertura

Cada dia abierto debe tener al menos:

- 1 trabajador APE
- 1 trabajador CIE

Si uno de los dos queda en cero, el dia entra en estado de error.

### 3. Regla de domingos

En el ciclo visible de 4 semanas, cada trabajador debe trabajar como maximo 2 domingos.

Si supera ese valor, se marca como error.

### 4. Regla de consecutivos

La regla se mide con ventana deslizante real.

No basta con sumar dias por semana ISO. La vista debe detectar el cruce entre semanas
cuando el libre cambia y aparece una racha mayor a 6.

### 5. Naturaleza exploratoria

La vista no busca esconder tensiones reales del modelo.

Si una dotacion chica queda con cobertura base pero muestra riesgo mensual de domingos
o consecutivos, eso se debe ver explicitamente como alerta y no maquillarse como
"factible perfecta".

## UX esperada

- La pantalla debe ser legible en desktop sin depender de scroll horizontal excesivo.
- El usuario debe poder cambiar de dotacion y opcion en 1 clic.
- Cambiar un libre debe recalcular la lectura al instante.
- Los errores deben decir exactamente donde se rompe:
  - trabajador
  - semana
  - dia
  - metrica afectada
- La vista debe invitar a comparar, no solo a inspeccionar una tabla.

## Criterios de aceptacion

- [ ] Existe la ruta `/admin/factibilidad`.
- [ ] Se puede cambiar entre `N=4..12`.
- [ ] Cada dotacion expone al menos 2 opciones comparables.
- [ ] Se pueden mover libres por trabajador/semana sin recargar la pagina.
- [ ] El panel lateral recalcula cobertura, domingos y consecutivos tras cada cambio.
- [ ] Los consecutivos se calculan por racha real y no por semana ISO.
- [ ] Hay tests unitarios del motor del analizador.
- [ ] `npm run build` pasa en `v2/frontend`.

## Riesgos conocidos

- Un ciclo puro de 4 semanas no captura por completo los bordes entre meses reales.
- Dotaciones chicas pueden verse "cubiertas" dia a dia y aun asi ser fragiles por domingos
  o rachas; eso es esperado y debe seguir visible.
- El esquema mixto con `COM` no se debe agregar hasta formalizar bien la regla de 42h
  con turno corto complementario.

## Siguiente iteracion recomendada

1. Agregar una tercera opcion `Mixto (COM + APE/CIE)` solo cuando la regla de horas quede cerrada.
2. Permitir guardar escenarios favoritos para comparacion posterior.
3. Incorporar un modo "mes real" que proyecte el patron sobre calendario real con 4 o 5 domingos.
4. Conectar este laboratorio con el optimizer lab o con una sucursal real como comparador.
