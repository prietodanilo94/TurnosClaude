# Documento Funcional v3

Este documento consolida la idea funcional inicial de `v3` del sistema de turnos.

Su objetivo es definir el producto antes del diseño técnico detallado. No fija todavía base de datos, framework ni arquitectura final. Sí fija el problema, los roles, la lógica operativa, los tipos de sucursal, las reglas de generación y las decisiones ya acordadas.

---

## 1. Objetivo del producto

`v3` debe permitir generar, revisar, ajustar, asignar y exportar calendarios de turnos mensuales por sucursal, respetando reglas laborales chilenas y diferencias reales de operación entre tipos de sucursal.

El sistema debe cubrir dos mundos:

- sucursales con turnos predefinidos o rotativos, donde la lógica principal es aplicar una plantilla válida
- sucursales complejas, especialmente malls de ventas que abren los 7 días, donde se necesita un solver para encontrar una solución factible u óptima

La meta no es solo construir turnos. La meta es construir una operación administrable por `admin` y `jefe_sucursal`, con continuidad semanal, asignación posterior de personas reales y exportación usable.

---

## 2. Usuarios y permisos

### 2.1. Admin

El usuario `admin` puede:

- ver todas las sucursales
- crear, editar y corregir sucursales
- modificar el tipo de sucursal
- definir o corregir el modo de generación de una sucursal
- generar calendarios
- recalcular
- editar manualmente turnos y libres
- asignar trabajadores reales a slots
- exportar
- proyectar meses futuros
- administrar restricciones y catálogos

### 2.2. Jefe de sucursal

El usuario `jefe_sucursal` puede:

- ver solo sus sucursales asignadas
- generar el calendario de su sucursal
- revisar y ajustar manualmente el calendario dentro de las reglas habilitadas
- asignar trabajadores reales a slots
- exportar

El `jefe_sucursal` no puede:

- cambiar el tipo de sucursal
- editar la clasificación estructural de la sucursal
- administrar catálogos globales

El tipo de sucursal queda hardcodeado o de solo lectura para jefe, y solo puede ser modificado por admin.

---

## 3. Relaciones del dominio

Queda explícitamente definido:

- una `sucursal` se relaciona con muchos `trabajadores`
- un `trabajador` pertenece a una sola `sucursal` activa a la vez
- no existe relación trabajador-trabajador como estructura del dominio

La generación del calendario no parte desde personas reales. Parte desde `slots anónimos`.

---

## 4. Clasificación inicial de sucursal

Cuando una sucursal ingresa por primera vez desde Excel y todavía no tiene configuración funcional, el sistema debe pedir clasificación al `admin`.

En esa primera clasificación se debe definir al menos:

- tipo de sucursal
- modo de generación

Una vez guardado:

- la clasificación queda persistida
- las siguientes cargas reutilizan esa configuración
- no se vuelve a preguntar automáticamente

Si la sucursal ya existe y tiene tipo definido, el sistema debe conservarlo.

Si la sucursal existe pero no tiene tipo o modo de generación definido, se debe obligar a completarlo antes de usarla.

El `jefe_sucursal` nunca clasifica ni reclasifica sucursales.

---

## 5. Unidad real de cálculo

La unidad real de cálculo no es el mes puro. Es la semana completa lunes-domingo.

La aplicación se mostrará y operará por mes, pero internamente debe calcular semanas completas.

### 4.1. Regla de borde inicial

Si el mes comienza a mitad de semana, por ejemplo un miércoles, el sistema debe calcular también lunes y martes de esa semana, aunque pertenezcan al mes anterior.

### 4.2. Regla de borde final

Si el mes termina a mitad de semana, por ejemplo un jueves, el sistema debe calcular también viernes, sábado y domingo de esa semana, aunque pertenezcan al mes siguiente.

### 4.3. Continuidad

Si ya existen turnos guardados, el nuevo cálculo debe considerar ese contexto previo para no romper:

- continuidad de rotación
- consistencia semanal
- horas semanales
- patrones ya iniciados

Esto aplica tanto a sucursales rotativas como a sucursales con solver.

---

## 6. Modelo general de generación

El calendario siempre se genera primero como una propuesta de `slots anónimos`.

Ejemplo:

- Trabajador 1
- Trabajador 2
- Trabajador 3
- ...
- Trabajador N

Donde `N` es la dotación efectiva considerada para la sucursal.

Después de generados los slots:

1. se revisa la propuesta
2. se aplican ajustes manuales si hace falta
3. se asignan trabajadores reales a los slots
4. se exporta

Esta regla se mantiene para todos los tipos de sucursal.

---

## 7. Modos de generación por sucursal

Cada sucursal debe tener un modo de generación explícito.

### 6.1. Rotativo 2 semanas

Aplica una plantilla de 2 semanas que alterna:

- semana 1
- semana 2
- semana 1
- semana 2

### 6.2. Rotativo 4 semanas

Aplica una plantilla de 4 semanas.

La imagen de referencia entregada por negocio se toma como una plantilla válida de este tipo y debe quedar disponible para selección o cálculo.

### 6.3. Solver optimizado

Aplica un modelo de optimización para sucursales donde la plantilla fija no resuelve bien el problema.

Regla acordada:

- el solver no se usa para sucursales rotativas normales
- el solver se usa para sucursales cuya operación incluye domingos
- esta condición se define al clasificar la sucursal, no por una lista rígida hardcodeada de nombres

### 6.4. Selección o cálculo

Para sucursales rotativas, idealmente debe existir la posibilidad de:

- seleccionar una plantilla predefinida
- calcular una propuesta compatible con la lógica de la sucursal

Esto permitirá comparar entre patrón histórico y generación automática.

---

## 8. Tipos de sucursal definidos hoy

### 7.1. Sucursales rotativas

Estas sucursales se consideran de turno fijo o rotativo, no necesariamente de solver principal:

- Postventa CAP
- Postventa D y P Vista Hermosa
- Postventa Stand Alone
- Postventa Mall Quilín y Movicenter
- Postventa Mall Tobalaba
- Postventa Mall Oeste
- Ventas Standalone
- Ventas Mall Autopark

### 8.2. Sucursales con problema de optimización

Estas sucursales se consideran solver-first cuando su clasificación indique operación dominical.

Por ahora se toma como categoría funcional:

- sucursales de ventas que trabajan domingo

La pertenencia exacta a esta categoría queda determinada al clasificar la sucursal al momento de la carga.

En ellas el sistema debe buscar una solución basada en dotación y restricciones, y si no existe solución factible debe devolver diagnóstico de insuficiencia en vez de aprobar automáticamente un calendario inviable.

---

## 9. Catálogo funcional de turnos actuales

Este bloque resume el negocio ya explicitado y debe convertirse después en plantilla formal.

### 8.1. Postventa CAP

Horario de funcionamiento:

- lunes a jueves `08:30-18:30`
- viernes `08:30-17:30`
- sábado `09:00-14:00`

Turnos:

- Opción A Mantener
  - lunes a jueves `08:30-18:00`
  - viernes `08:30-17:30`
  - sábado libre
  - domingo libre
  - `42h`
- Opción B Reducido
  - lunes a jueves `08:30-17:00`
  - viernes `08:30-16:30`
  - sábado `09:00-14:00`
  - domingo libre
  - `42h`

Modo esperado:

- rotativo semanal entre A y B

### 8.2. Postventa D y P Vista Hermosa

Horario de funcionamiento:

- lunes a jueves `08:30-18:30`
- viernes `08:30-17:30`

Turno:

- Único
  - lunes a jueves `08:30-18:00`
  - viernes `08:30-17:30`
  - sábado libre
  - domingo libre
  - `42h`

Modo esperado:

- fijo no rotativo

### 8.3. Postventa Stand Alone

Mismo patrón funcional que Postventa CAP.

Modo esperado:

- rotativo semanal entre A y B

### 8.4. Postventa Mall Quilín y Movicenter

Mismo patrón funcional que Postventa CAP.

Modo esperado:

- rotativo semanal entre A y B

### 8.5. Postventa Mall Tobalaba

Mismo patrón funcional que Postventa CAP.

Modo esperado:

- rotativo semanal entre A y B

### 8.6. Postventa Mall Oeste

Horario de funcionamiento:

- lunes a jueves `08:00-17:30`
- viernes `08:00-17:00`
- sábado `09:00-14:00`

Turnos:

- Opción A Mantener
  - lunes a jueves `08:00-17:30`
  - viernes `08:00-17:00`
  - sábado libre
  - domingo libre
  - `42h`
- Opción B Reducido
  - lunes a jueves `08:00-16:30`
  - viernes `08:00-16:00`
  - sábado `09:00-14:00`
  - domingo libre
  - `42h`

Modo esperado:

- rotativo semanal entre A y B

### 8.7. Ventas Standalone

Horario de funcionamiento declarado:

- lunes a viernes `09:00-19:00`
- sábado `10:00-14:30`

Turnos operativos actuales:

- Apertura
  - lunes a jueves `09:00-18:30`
  - viernes `09:00-18:00`
  - domingo libre
  - `42h`
- Cierre
  - lunes a viernes `10:30-19:00`
  - sábado `10:00-14:30`
  - domingo libre
  - `42h`

Modo esperado:

- rotación semanal apertura/cierre

### 8.8. Ventas Mall Autopark

Horario de funcionamiento:

- lunes a sábado `10:00-19:00`

Turnos:

- Apertura
  - lunes a sábado `10:00-18:00`
  - domingo libre
  - `42h`
- Cierre
  - lunes a viernes `11:00-19:00`
  - sábado `12:00-19:00`
  - domingo libre
  - `42h`

Modo esperado:

- rotación semanal apertura/cierre

### 8.9. Ventas Mall 7 días

Sucursales:

- Movicenter
- Tobalaba
- Vespucio
- Arauco
- Egaña
- Sur

Problema declarado:

- `42` horas exactas trabajadas
- máximo `6` días seguidos
- `2` domingos libres al mes

Objetivo del solver:

- construir la mezcla óptima según la dotación de la sucursal
- usando combinaciones basadas en:
  - `2` turnos de `9h` laborales
  - `3` turnos de `8h` laborales

Este es el núcleo de optimización principal del negocio.

---

## 10. Regla funcional de dotación

La dotación de una sucursal se define, para efectos del calendario, como la cantidad de trabajadores activos asociados a esa sucursal.

Regla base:

- cantidad de trabajadores activos = cantidad de slots anónimos a generar

Ejemplo:

- 5 trabajadores activos = 5 slots
- 9 trabajadores activos = 9 slots

### 10.1. Reparto en plantillas rotativas

Cuando una sucursal usa una plantilla con más de una fase o variante, los slots deben repartirse lo más parejo posible entre las fases disponibles.

Regla sugerida:

- la diferencia máxima entre grupos no debe superar `1`

Ejemplos:

- 8 slots con patrón A/B → `4` y `4`
- 9 slots con patrón A/B → `5` y `4`
- 10 slots con patrón de 4 fases → `3`, `3`, `2`, `2`

Esta regla aplica como criterio de generación inicial para el MVP.

---

## 11. Restricciones del negocio

Las restricciones afectan a todo el sistema, no solo al solver.

### 9.1. Restricciones generales

- `42` horas laborales semanales exactas cuando aplique el patrón definido
- máximo `6` días seguidos trabajados
- mínimo `2` domingos libres al mes en los casos que correspondan

### 9.2. Restricciones individuales

El sistema debe soportar restricciones por trabajador en cualquier modo de generación:

- vacaciones
- días no disponibles
- prohibición o preferencia de ciertos turnos
- otras restricciones futuras equivalentes

### 9.3. Ajuste manual posterior

Los casos excepcionales, por ejemplo favorecer a una persona con pura apertura, no se modelan inicialmente como restricción principal del generador.

Se tratarán como ajuste manual posterior porque negocio indica que ocurrirá poco.

---

## 12. Edición manual

Después de generar una propuesta, debe existir edición manual.

La edición manual debe permitir al menos:

- cambiar un libre
- mover o ajustar el día dentro del mismo slot lógico
- aplicar ajustes excepcionales dentro del mismo trabajador lógico

El sistema debe conservar trazabilidad de estos cambios.

Los ajustes manuales aplican tanto a calendarios de plantilla como a calendarios generados por solver.

---

## 13. Plantilla de 4 semanas

La plantilla de 4 semanas no debe existir solo como imagen de referencia. Debe formalizarse como dato estructurado del sistema.

Formalizarla significa guardarla como una plantilla seleccionable y reutilizable, con:

- nombre
- tipo de sucursal aplicable
- longitud del ciclo: `4 semanas`
- fases del ciclo
- horario por día de cada fase
- días libres explícitos

Esto permitirá:

- seleccionarla al generar
- calcular sobre ella
- proyectarla a meses futuros
- mantener consistencia sin depender de una imagen manual

La imagen entregada por negocio se considera el primer insumo funcional para esta plantilla.

---

## 14. Relación entre dotación y calendario

Este es uno de los problemas centrales de `v3`.

Dado:

- un tipo de sucursal
- una dotación `N`
- una plantilla o familia de turnos posibles
- restricciones generales
- restricciones individuales

El sistema debe construir un calendario de `N` slots anónimos para el período solicitado.

Queda pendiente definir con mayor precisión:

- cómo se distribuyen los patrones cuando la dotación no cuadra limpio con la plantilla histórica
- cuál es la regla de mezcla entre semana A, semana B o patrón de 4 semanas
- cuándo se usa una plantilla exacta y cuándo se recalcula una variante

Este punto debe cerrarse en el diseño funcional detallado del generador.

---

## 15. Flujo principal de usuario

### 15.1. Flujo admin

1. inicia sesión
2. ve todas las sucursales
3. entra a una sucursal
4. revisa tipo de sucursal, modo de generación, dotación y restricciones
5. genera calendario del mes
6. revisa la propuesta por slots anónimos
7. ajusta manualmente si hace falta
8. asigna trabajadores reales a los slots
9. exporta

### 15.2. Flujo jefe de sucursal

1. inicia sesión
2. ve solo sus sucursales
3. entra a la sucursal
4. genera o revisa calendario
5. no puede cambiar el tipo de sucursal
6. asigna trabajadores reales a los slots
7. exporta

---

## 16. Acciones principales del producto

### 16.1. Generar por mes

Debe existir un botón para generar por mes.

Internamente:

- toma el mes solicitado
- lo extiende a semanas completas
- incorpora contexto previo o siguiente si hace falta
- devuelve la propuesta visible para ese mes

### 16.2. Proyección hasta fin de año

Debe existir una acción futura para proyectar hasta fin de año.

Regla acordada:

- esta proyección se realiza una vez que los trabajadores reales ya están asignados

No forma parte del MVP inicial, pero queda declarada como objetivo posterior del producto.

---

## 17. Salidas del sistema

El sistema debe permitir al menos:

- exportación operativa principal igual a `v1/v2`
- exportación alternativa para uso de sucursal o jefatura igual a `v1/v2`

Los formatos base ya existen en `v1/v2` y deben reutilizarse como referencia funcional de `v3`.

---

## 18. Decisiones ya acordadas

- el tipo de sucursal lo edita solo admin
- jefe de sucursal lo ve hardcodeado o en solo lectura
- la primera vez que una sucursal entra desde Excel se clasifica y esa decisión queda guardada
- la relación estructural es sucursal-trabajadores, no trabajador-trabajador
- los slots siempre son anónimos primero
- la asignación de personas reales siempre viene después
- las restricciones afectan a todos los tipos de generación
- la edición manual existe para todos los tipos de calendario
- la preferencia rara, como dejar a alguien siempre en apertura, se resuelve como ajuste manual posterior
- el cálculo real debe considerar semanas completas y continuidad con meses adyacentes
- debe existir opción de trabajar con plantillas rotativas de 4 semanas
- el solver solo aplica a sucursales con operación dominical
- si el solver no encuentra solución factible, debe devolver diagnóstico y no aprobar automáticamente una solución inviable
- la dotación base de generación es la cantidad de trabajadores activos de la sucursal
- el reparto de slots entre fases rotativas debe ser lo más parejo posible

---

## 19. Alcance sugerido para MVP

El MVP recomendado de `v3` debería incluir:

- login con roles admin y jefe_sucursal
- listado de sucursales
- ficha de sucursal con tipo y modo de generación
- generación mensual extendida a semanas completas
- soporte de sucursales rotativas
- soporte de sucursales solver-first para mall 7 días
- vista de calendario por slots anónimos
- asignación manual de trabajadores reales
- edición manual básica posterior
- exportación

No es necesario en el primer MVP:

- proyección hasta fin de año completa
- preferencias avanzadas por trabajador como parte del generador principal
- automatización compleja de ajustes personalizados poco frecuentes

---

## 20. Información aún faltante

Para cerrar este documento y pasar al diseño técnico, aún falta precisar:

### 20.1. Catálogo exacto de tipos de sucursal

Decisión cerrada:

- el catálogo actual de tipos de sucursal se considera completo para `v3`

### 20.2. Plantilla de 4 semanas

Decisión cerrada:

- existe una sola plantilla base de 4 semanas hasta ahora
- esa plantilla funciona como alternativa a no usar solver
- pueden existir más plantillas en el futuro, pero no forman parte de la definición inicial

### 20.3. Restricciones individuales del MVP

Se toma como base usar las mismas restricciones de `v1/v2`, pero aún falta enumerarlas formalmente en el documento técnico con su comportamiento exacto.

### 20.4. Exportaciones

Decisión cerrada:

- `v3` reutiliza los dos formatos de exportación ya existentes en `v1/v2`
- el detalle exacto se documentará en diseño técnico tomando esas implementaciones como fuente funcional

### 20.5. Gestión de continuidad

La regla general ya está definida, pero aún falta transformarla en reglas operativas detalladas para diseño técnico:

- qué datos arrastran contexto semanal
- cuándo se recalcula
- cuándo se bloquea
- cuándo solo se advierte

---

## 21. Próximo paso recomendado

Con este documento ya se puede pasar a la siguiente etapa:

- diseño técnico pre-construcción de `v3`

Antes de eso, conviene solo formalizar técnicamente las reglas que ya quedaron cerradas en este documento.
