# Spec 001 — Optimizer Playground

## Objetivo

Construir la primera vertical slice de `v3` como una página de laboratorio del optimizador.

La idea no es partir por todo el producto. La idea es validar primero el corazón del problema:

- cómo responde el solver según la dotación
- cuándo una sucursal dominical es factible o infactible
- qué propuestas devuelve
- qué diagnóstico entrega cuando no alcanza la dotación

Esta pantalla servirá como herramienta de validación técnica y de negocio antes de construir el flujo completo de importación, clasificación, calendario y exportación.

## Alcance funcional

Página interna tipo laboratorio, visualmente alineada con la esencia de `v1/v2`, donde el usuario pueda:

1. seleccionar un tipo o categoría de sucursal dominical
2. seleccionar mes y año
3. indicar dotación
4. configurar parámetros del solver
5. generar propuestas
6. ver diagnóstico de factibilidad
7. ver los slots anónimos resultantes
8. revisar horas, domingos, cobertura y score

## Qué resuelve esta spec

Resuelve la pregunta:

> “Si tengo esta categoría de sucursal, este mes y esta dotación, ¿el solver encuentra una solución útil o no?”

## Qué no resuelve aún

- no reemplaza el flujo completo del producto
- no necesita importación Excel todavía
- no necesita asignación de trabajadores reales todavía
- no necesita exportación todavía
- no necesita persistir como calendario productivo final

## Ruta propuesta

Ruta inicial sugerida:

- `/admin/optimizer-lab`

Si todavía no existe auth de `v3`, puede construirse primero como ruta protegida mínima o incluso modo técnico temporal. La intención final es que quede dentro del panel admin.

## Inputs mínimos

### Categoría de sucursal

El playground debe permitir elegir una categoría dominical de prueba.

Por ahora puede trabajar con una categoría funcional como:

- `ventas_mall_dominical`

Después podrá refinarse por tipo exacto de sucursal.

### Período

- `year`
- `month`

### Dotación

Número entero de slots anónimos a generar.

Este valor representa la cantidad de trabajadores activos hipotéticos para la prueba.

### Parámetros del solver

Exponer al menos:

- horas semanales objetivo
- máximo días consecutivos
- domingos libres mínimos
- número de propuestas
- límite de tiempo

## Datos base de la prueba

El playground debe usar:

- catálogo de turnos dominicales vigente
- reglas laborales heredadas de `v1/v2`
- semanas completas extendidas
- feriados del mes si ya existen en seed o fixture

Para esta spec se permiten fixtures o seeds controlados en vez de depender de la importación real.

## Salida esperada

La página debe mostrar:

### Diagnóstico

- dotación disponible
- dotación mínima sugerida
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
- días del mes
- turnos asignados
- libres

### Métricas

Al menos:

- horas por slot
- domingos trabajados / libres
- cobertura por día
- cantidad de turnos de cada tipo

## Reglas clave

### R1. Solver only

Esta pantalla está pensada principalmente para sucursales con operación dominical.

No intenta resolver todavía el flujo completo de plantillas rotativas.

### R2. Diagnóstico obligatorio

Si el solver no encuentra solución factible:

- no debe “simular éxito”
- debe mostrar diagnóstico explícito
- debe sugerir dotación mínima si está disponible

### R3. Slots anónimos

La salida siempre se muestra por slots anónimos.

No hay trabajadores reales todavía.

### R4. UI familiar

La UI debe sentirse como una versión simplificada del calendario de `v1/v2`, no como una herramienta completamente distinta.

## Criterios de aceptación

- [ ] Existe una ruta de playground del optimizador en `v3`
- [ ] Permite elegir mes, año y dotación
- [ ] Permite correr el solver sin depender todavía de importación Excel
- [ ] Muestra claramente si el problema es factible o infactible
- [ ] Muestra diagnóstico de insuficiencia cuando no hay solución
- [ ] Muestra al menos una grilla de resultado por slots anónimos
- [ ] El estilo general de la página mantiene la esencia de `v1/v2`
- [ ] La vertical slice sirve para conversar contigo sobre calidad real del solver antes de seguir con el resto del MVP
