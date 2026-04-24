# Spec 001 - Optimizer Playground

## Objetivo

Construir la primera vertical slice de `v3` como una pagina de laboratorio del optimizador.

La idea no es partir por todo el producto. La idea es validar primero el corazon del problema:

- como responde el solver segun la dotacion
- cuando una sucursal dominical es factible o infactible
- que propuestas devuelve
- que diagnostico entrega cuando no alcanza la dotacion

Esta pantalla servira como herramienta de validacion tecnica y de negocio antes de construir el flujo completo de importacion, clasificacion, calendario y exportacion.

## Alcance funcional

Pagina interna tipo laboratorio, visualmente alineada con la esencia de `v1/v2`, donde el usuario pueda:

1. seleccionar un tipo o categoria de sucursal dominical
2. seleccionar mes y ano
3. indicar dotacion
4. configurar parametros del solver
5. generar propuestas
6. ver diagnostico de factibilidad
7. ver los slots anonimos resultantes
8. revisar horas, domingos, cobertura y score

## Que resuelve esta spec

Resuelve la pregunta:

> "Si tengo esta categoria de sucursal, este mes y esta dotacion, el solver encuentra una solucion util o no?"

## Que no resuelve aun

- no reemplaza el flujo completo del producto
- no necesita importacion Excel todavia
- no necesita asignacion de trabajadores reales todavia
- no necesita exportacion todavia
- no necesita persistir como calendario productivo final

## Ruta propuesta

Ruta inicial sugerida:

- `/admin/optimizer-lab`

Si todavia no existe auth de `v3`, puede construirse primero como ruta protegida minima o incluso modo tecnico temporal. La intencion final es que quede dentro del panel admin.

## Inputs minimos

### Categoria de sucursal

El playground debe permitir elegir una categoria dominical de prueba.

Por ahora puede trabajar con una categoria funcional como:

- `ventas_mall_dominical`

Despues podra refinarse por tipo exacto de sucursal.

### Periodo

- `year`
- `month`

### Dotacion

Numero entero de slots anonimos a generar.

Este valor representa la cantidad de trabajadores activos hipoteticos para la prueba.

### Parametros del solver

Exponer al menos:

- horas semanales objetivo
- maximo dias consecutivos
- domingos libres minimos
- numero de propuestas
- limite de tiempo

## Datos base de la prueba

El playground debe usar:

- catalogo de turnos dominicales vigente
- reglas laborales heredadas de `v1/v2`
- semanas completas extendidas
- feriados del mes si ya existen en seed o fixture

Para esta spec se permiten fixtures o seeds controlados en vez de depender de la importacion real.

## Salida esperada

La pagina debe mostrar:

### Diagnostico

- dotacion disponible
- dotacion minima sugerida
- factible / infactible
- mensajes del solver

### Propuestas

Lista de propuestas encontradas con:

- score
- modo
- cantidad de slots
- indicadores resumidos

### Vista de resultado

Una grilla tipo calendario, similar en esencia a `v1/v2`, mostrando:

- filas por `Trabajador 1..N`
- dias del mes
- turnos asignados
- libres

### Metricas

Al menos:

- horas por slot
- domingos trabajados / libres
- cobertura por dia
- cantidad de turnos de cada tipo

## Reglas clave

### R1. Solver only

Esta pantalla esta pensada principalmente para sucursales con operacion dominical.

No intenta resolver todavia el flujo completo de plantillas rotativas.

### R2. Diagnostico obligatorio

Si el solver no encuentra solucion factible:

- no debe simular exito
- debe mostrar diagnostico explicito
- debe sugerir dotacion minima si esta disponible

### R3. Slots anonimos

La salida siempre se muestra por slots anonimos.

No hay trabajadores reales todavia.

### R4. UI familiar

La UI debe sentirse como una version simplificada del calendario de `v1/v2`, no como una herramienta completamente distinta.

## Criterios de aceptacion

- [x] Existe una ruta de playground del optimizador en `v3`
- [x] Permite elegir mes, ano y dotacion
- [x] Permite correr el solver sin depender todavia de importacion Excel
- [x] Muestra claramente si el problema es factible o infactible
- [x] Muestra diagnostico de insuficiencia cuando no hay solucion
- [x] Muestra al menos una grilla de resultado por slots anonimos
- [x] El estilo general de la pagina mantiene la esencia de `v1/v2`
- [ ] La vertical slice sirve para conversar contigo sobre calidad real del solver antes de seguir con el resto del MVP
