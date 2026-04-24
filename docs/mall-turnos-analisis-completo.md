+# Análisis completo de turnos — Sucursal Mall 7 días

> Documento de diseño y factibilidad. Parte desde cero sin asumir el catálogo existente.
> Versión: 2026-04-24

---

## 1. Definición del problema

| Parámetro | Valor |
|-----------|-------|
| Horario de atención | 10:00-20:00 (10h diarias) |
| Días abiertos | 7 días/semana (lunes a domingo) |
| Horas laborales objetivo | 42h/semana por trabajador |
| Colación | 1h, se descuenta del tiempo de presencia |
| Cobertura mínima | ≥1 trabajador en sucursal durante 10:00-20:00 todos los días |
| Máx domingos | 2 domingos trabajados por mes por trabajador |
| Máx consecutivos | 6 días seguidos trabajados |

**Fórmula clave:**

```
horas_presencia_turno = horas_laborales + 1h (colación)
```

Si un turno figura como "7h laborales", el trabajador está en la sucursal 8 horas (la hora de colación está incluida dentro de su ventana de presencia, no se agrega al final).

---

## 2. Tipos de turno analizados

### 2.1 Turno Apertura (T-APE)

| Campo | Valor |
|-------|-------|
| Horario presencia | 10:00-18:00 |
| Horas presencia | 8h |
| Horas laborales | 7h (8h − 1h colación) |
| Días/semana para 42h | **6 días × 7h = 42h** ✓ |
| Cubre solo | 10:00-18:00 → deja 18:00-20:00 sin cobertura |

**Justificación 42h:** 7 es divisor exacto de 42 (42 ÷ 7 = 6 días). Con 1 día libre a la semana se llega exactamente a la jornada legal.

### 2.2 Turno Cierre (T-CIE)

| Campo | Valor |
|-------|-------|
| Horario presencia | 12:00-20:00 |
| Horas presencia | 8h |
| Horas laborales | 7h (8h − 1h colación) |
| Días/semana para 42h | **6 días × 7h = 42h** ✓ |
| Cubre solo | 12:00-20:00 → deja 10:00-12:00 sin cobertura |

### 2.3 Turno Completo (T-COM)

| Campo | Valor |
|-------|-------|
| Horario presencia | 10:00-20:00 |
| Horas presencia | 10h |
| Horas laborales | 9h (10h − 1h colación) |
| Días/semana para 42h | **42 ÷ 9 = 4,67 días → NO calza exacto** ✗ |
| Cubre solo | 10:00-20:00 ✓ (1 persona cubre el día completo) |

**Por qué T-COM no calza 42h:**

- 4 días × 9h = 36h (6h bajo el objetivo)
- 5 días × 9h = 45h (3h sobre el límite legal)
- Alternativa: 4 días T-COM + 1 día corto = 36 + 6 = 42h, pero ese día corto no cubre el día solo → siempre necesita otro trabajador presente

**Conclusión:** T-COM puro no es un esquema autosuficiente para 42h semanales exactas. Se puede usar como complemento.

### 2.4 Resumen de compatibilidad

| Turno | Calza 42h | Cubre día solo | Puede ir solo |
|-------|-----------|---------------|---------------|
| T-APE | ✓ (6 días) | ✗ (falta 18-20h) | ✗ |
| T-CIE | ✓ (6 días) | ✗ (falta 10-12h) | ✗ |
| T-COM | ✗ (4,67 días) | ✓ | Solo como complemento |
| T-APE + T-CIE combinados | ✓ | ✓ | ✓ |

---

## 3. Esquemas de turno

Los esquemas se evalúan según tres criterios:
1. Cobertura diaria (10:00-20:00 sin brechas)
2. 42h laborales exactas por semana
3. Domingos y días consecutivos manejables

---

### Esquema A — APE + CIE fijo

Cada trabajador tiene un rol fijo durante todo el mes: o siempre hace T-APE o siempre hace T-CIE.

- **Mitad del equipo:** T-APE (10:00-18:00), 6 días/semana, 1 día libre rotativo
- **Otra mitad:** T-CIE (12:00-20:00), 6 días/semana, 1 día libre rotativo

**Cobertura diaria:**
```
10:00 ──── 12:00 ──────── 18:00 ──── 20:00
   [APE ███████████████████]
                [CIE ███████████████████]
```
Juntos cubren sin brecha 10:00-20:00. Individualmente, ninguno cubre todo.

**Regla de cobertura garantizada:** para que no haya brecha en ningún día, nunca pueden estar libres todos los APE en el mismo día, ni todos los CIE. Por eso se necesitan **mínimo 2 APE y 2 CIE** (= N ≥ 4).

**Horas:** 6 días × 7h = **42h exactas** ✓

**Ventajas:** esquema más simple de gestionar. Cada trabajador siempre sabe su horario.

**Desventajas:** los APE siempre trabajan de mañana y los CIE siempre de tarde → menos equidad.

---

### Esquema B — Rotativo semanal (APE ↔ CIE)

El equipo se divide en dos grupos y alternan el turno cada semana:

- **Grupo 1:** Sem 1 → T-APE, Sem 2 → T-CIE, Sem 3 → T-APE, Sem 4 → T-CIE
- **Grupo 2:** Sem 1 → T-CIE, Sem 2 → T-APE, Sem 3 → T-CIE, Sem 4 → T-APE

**Cobertura:** en cada semana siempre hay un grupo haciendo APE y el otro CIE → cobertura garantizada igual que Esquema A.

**Horas:** cada semana sigue siendo 6 días × 7h = **42h exactas** ✓

**Ventajas:** alta equidad (todos pasan por mañana y tarde). Más atractivo para el equipo.

**Desventajas:** requiere comunicación clara del calendario mensual. Factibilidad idéntica a Esquema A.

---

### Esquema C — COM puro

Todos hacen T-COM (10:00-20:00).

**Cobertura:** con ≥2 trabajadores (días libres distintos), siempre hay alguien → ✓

**Horas:** 9h/día × 4 días = 36h (bajo). 9h/día × 5 días = 45h (ilegal). **No calza 42h** ✗

**Salvación parcial:** 4 días T-COM + 1 día T-CORTO (6h laborales, 7h presencia, ej. 13:00-20:00):
- 36h + 6h = **42h** ✓
- Pero T-CORTO no cubre el día solo → solo funciona si otro COM worker está ese día
- Añade complejidad a la planificación

**Conclusión:** Esquema C no es recomendable como esquema base. Puede usarse como complemento en Esquema D.

---

### Esquema D — Mixto (COM + APE/CIE)

Algunos trabajadores hacen T-COM (cubren el día completo solos), otros hacen T-APE o T-CIE (refuerzan la cobertura en mañana o tarde).

**Ejemplo con N=6:** 2 COM + 2 APE + 2 CIE
- Los 2 COM cubren el día completo con días libres alternados
- Los APE/CIE agregan cobertura adicional en sus franjas

**Horas COM:** necesita turno corto adicional para llegar a 42h (ver Esquema C).

**Horas APE/CIE:** 6 días × 7h = 42h ✓

**Cuándo tiene sentido:** cuando se quiere garantizar siempre ≥2 personas simultáneas en alguna franja, usando los COM como "base" y APE/CIE como refuerzo.

---

### Esquema E — Rotativo mensual (4 horarios distintos)

Variante donde el horario puede cambiar semana a semana con más libertad:

- Sem 1: todos T-APE
- Sem 2: todos T-CIE
- Sem 3: todos T-APE
- Sem 4: todos T-CIE

**Problema:** si TODOS hacen T-APE en la misma semana, 18:00-20:00 queda sin cobertura → **inviable**.

**Variante correcta:** siempre la mitad APE y la mitad CIE, pero qué mitad hace qué rota por semana. Esto es exactamente el **Esquema B**.

---

## 4. Restricción de días consecutivos — análisis detallado

Esta es la restricción más delicada y la que los solvers actuales no implementan bien.

### 4.1 Patrón base (sin problemas)

Con **día libre fijo** (siempre el mismo día de la semana), el máximo de consecutivos dentro de una semana es 6:

```
Ejemplo: libre el miércoles
L  M  [X]  J  V  S  D
✓  ✓   ✗   ✓  ✓  ✓  ✓
= 2 + 4 = max 4 consecutivos en semana
```

```
Ejemplo: libre el lunes
[X]  M  M  J  V  S  D
 ✗   ✓  ✓  ✓  ✓  ✓  ✓
= 6 consecutivos (Mar-Dom)
```

El cruce entre semanas depende del día libre de la semana anterior:

```
Semana N (libre lunes): trabaja Mar-Dom (6 días)
Semana N+1 (libre lunes): trabaja Mar-Dom (6 días)
Cruce: Dom(N) → Lun(OFF) → Mar(N+1) = BREAK ✓
Max consecutivos: 6 ✓
```

```
Semana N (libre domingo): trabaja Lun-Sáb (6 días)
Semana N+1 (libre miércoles): trabaja Lun, Mar, [OFF], Jue, Vie, Sáb, Dom
Cruce: Sáb(N) → Dom(N, OFF) → Lun(N+1) = BREAK en Dom ✓
Max en N: 6 (Lun-Sáb), Max en N+1: 4 (Jue-Dom)
Max consecutivos: 6 ✓
```

**El caso problemático:**

```
Semana N (libre miércoles): trabaja Lun, Mar, [OFF], Jue, Vie, Sáb, Dom
Semana N+1 (libre sábado): trabaja Lun, Mar, Mié, Jue, Vie, [OFF], Dom

Cruce: Dom(N) → Lun(N+1) → Mar → Mié → Jue → Vie = 1+5 = 6 → OK ✓
Pero cruce: Dom(N) + Lun+Mar+Mié+Jue+Vie(N+1) = 6... depende del inicio de N-1

Ejemplo peligroso:
Semana N (libre miércoles): Jue-Dom = 4 días al final de semana
Semana N+1 (libre miércoles también): Lun-Mar = 2 días al inicio
Cruce: 4 + 2 = 6 ✓ OK

Semana N (libre miércoles): ...Jue, Vie, Sáb, Dom = 4 días
Semana N+1 (libre JUEVES): Lun, Mar, Mié, [OFF], Vie, Sáb, Dom
Cruce: Dom(N) → Lun → Mar → Mié(N+1) = 1+3 = 4 → OK ✓
```

### 4.2 El problema real con la rotación dominical

Los domingos son el problema. Cuando un trabajador trabaja 2 domingos al mes y tiene 2 domingos libres, su día libre **cambia** dependiendo de si trabaja ese domingo o no.

**Semana con domingo trabajado:** libre algún día de semana (ej. miércoles)
**Semana con domingo libre:** libre el domingo

```
Semana N (trabaja Dom, libre Mié):
Lun, Mar, [OFF Mié], Jue, Vie, Sáb, DOM
Secuencia final: Jue+Vie+Sáb+Dom = 4 días

Semana N+1 (domingo libre):
Lun, Mar, Mié, Jue, Vie, Sáb, [OFF Dom]
Secuencia inicial: Lun+Mar+Mié+Jue+Vie+Sáb = 6 días

Cruce: Dom(N) → Lun(N+1) → ... → Sáb(N+1) = 1+6 = 7 días ✗ VIOLA RESTRICCIÓN
```

**Solución:** cuando un trabajador trabaja el domingo de la semana N, en la semana N+1 su día libre debe ser el **lunes** (no el domingo):

```
Semana N (trabaja Dom, libre Mié):
[...Dom = último día trabajado]

Semana N+1 (libre LUNES):
[OFF Lun], Mar, Mié, Jue, Vie, Sáb, Dom(¿trabaja?)
Cruce: Dom(N) → [OFF Lun(N+1)] = BREAK ✓
```

**Regla derivada:** si un trabajador trabaja el domingo de la semana N, su libre en la semana N+1 es el lunes. Esto elimina el riesgo de racha >6.

Esta regla no puede derivarse automáticamente de la lógica semanal — requiere planificación mensual explícita o una restricción de solver que razone sobre el cruce de semanas.

---

## 5. Análisis por número de trabajadores

### Notación

- **N** = número total de trabajadores
- **n_APE** = trabajadores que hacen T-APE (en Esquema A/B)
- **n_CIE** = trabajadores que hacen T-CIE
- **Slots-dom disponibles** = N × 2 (máx 2 domingos/mes por trabajador)
- **Slots-dom necesarios** = domingos del mes × 2 (1 APE + 1 CIE por domingo en E-A/B)
- **Margen** = slots disponibles − slots necesarios

Meses típicos: 4 domingos. Meses excepcionales: 5 domingos.

---

### N = 2

**Distribución:** 1 APE + 1 CIE

**Cobertura:** cada día, el APE puede estar libre O el CIE puede estar libre. Si coinciden en el mismo día libre → brecha. Con solo 1 de cada tipo y 1 día libre cada uno, en algún momento cada uno descansa → ese día solo hay 1 tipo de turno y la cobertura queda incompleta. **No factible.**

Adicionalmente:
- Slots-dom disponibles: 4 (2 por trabajador)
- Slots-dom necesarios: 8 (2 por domingo × 4 domingos)
- Déficit: -4

**Veredicto: ✗ INFACTIBLE** — cobertura insuficiente y domingos imposibles.

---

### N = 3

**Distribución:** 1 APE + 2 CIE o 2 APE + 1 CIE

**Cobertura:**
- Con 2 APE + 1 CIE: los 2 APE tienen días libres distintos → siempre hay 1 APE ✓. El único CIE tiene 1 día libre → ese día 18:00-20:00 sin cobertura ✗
- Con 1 APE + 2 CIE: idem, el único APE tiene su día libre y 10:00-12:00 queda sin cobertura ✗

**Veredicto cobertura: ✗** — siempre hay al menos 1 día a la semana con brecha.

**Domingos:**
- Slots disponibles: 6
- Slots necesarios: 8
- Déficit: -2

**Veredicto: ✗ INFACTIBLE** — cobertura y domingos insuficientes.

---

### N = 4

**Distribución:** 2 APE + 2 CIE

**Cobertura:**
- 2 APE con días libres distintos → siempre ≥1 APE presente ✓
- 2 CIE con días libres distintos → siempre ≥1 CIE presente ✓
- Cobertura diaria garantizada ✓

**Horas:** 6 días × 7h = 42h por trabajador ✓

**Domingos:**
- Slots APE disponibles: 2 × 2 = 4. Slots APE necesarios: 4 (1 APE por domingo). Margen: 0
- Slots CIE disponibles: 2 × 2 = 4. Slots CIE necesarios: 4. Margen: 0
- **Cero margen para ausencias.** Si 1 trabajador falta 1 domingo → brecha.
- En mes de 5 domingos: déficit de 1 slot en cada tipo → **inviable en meses de 5 domingos**.

**Consecutivos:** con la planificación mensual correcta (libre el lunes la semana siguiente a un domingo trabajado), max 6 ✓. Sin esta planificación, riesgo de 7 días.

**Plantilla semanal de referencia:**

| Worker | Turno | L | M | X | J | V | S | D | Horas |
|--------|-------|---|---|---|---|---|---|---|-------|
| APE-1  | APE   | APE | APE | APE | APE | APE | APE | **LIB** | 42h |
| APE-2  | APE   | APE | APE | APE | APE | APE | **LIB** | APE | 42h |
| CIE-1  | CIE   | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | 42h |
| CIE-2  | CIE   | CIE | CIE | **LIB** | CIE | CIE | CIE | CIE | 42h |

*Cobertura por día:*

| Día | APE presentes | CIE presentes | Cobertura |
|-----|--------------|--------------|-----------|
| L | APE-1, APE-2 | CIE-1, CIE-2 | ✓ (10-20h) |
| M | APE-1, APE-2 | CIE-1, CIE-2 | ✓ |
| X | APE-1, APE-2 | CIE-1 | ✓ |
| J | APE-1, APE-2 | CIE-2 | ✓ |
| V | APE-1, APE-2 | CIE-1, CIE-2 | ✓ |
| S | APE-1, APE-2 | CIE-1, CIE-2 | ✓ |
| D | APE-2 | CIE-1, CIE-2 | ✓ (mínimo: 1 APE + 2 CIE) |

*Distribución dominical mensual (margen cero):*

| Domingo | APE presente | CIE presente |
|---------|-------------|-------------|
| Dom 1 | APE-1 | CIE-1 |
| Dom 2 | APE-2 | CIE-2 |
| Dom 3 | APE-1 | CIE-2 |
| Dom 4 | APE-2 | CIE-1 |

Cada APE trabaja exactamente 2 domingos/mes ✓. Cada CIE también ✓. Margen = 0.

**Veredicto: ⚠ FACTIBLE AJUSTADO** — matemáticamente posible, operativamente frágil. No tolera ausencias sin plan de contingencia.

---

### N = 5

**Distribución:** 3 APE + 2 CIE (o 2 APE + 3 CIE)

**Cobertura:** ≥2 de cada tipo → días libres distintos garantizan ≥1 de cada tipo cada día ✓

**Horas:** 42h ✓

**Domingos (3 APE + 2 CIE):**
- Slots APE: 3 × 2 = 6. Necesarios: 4. Margen: **+2**
- Slots CIE: 2 × 2 = 4. Necesarios: 4. Margen: 0
- En mes de 5 domingos: slots APE = 6 ≥ 5 ✓, slots CIE = 4 < 5 ✗

**Alternativa 2 APE + 3 CIE:** mismo problema pero invertido (CIE con margen, APE sin margen).

**Mejor solución para N=5:** usar esquema rotativo (B) donde los 5 rotan entre APE y CIE. En ese caso, todos son "del mismo tipo" en cada semana y no hay asimetría:
- Sem 1: 3 hacen APE, 2 hacen CIE
- Sem 2: 2 hacen APE, 3 hacen CIE
- Domingos: 5 workers × 2 = 10 slots; necesarios = 8 (4 dom × 2). Margen: **+2** ✓

**Consecutivos:** con planificación correcta, max 6 ✓

**Plantilla semanal (Esquema B rotativo, N=5):**

*Semana tipo A (3 APE + 2 CIE):*

| Worker | Semana A | L | M | X | J | V | S | D | Horas |
|--------|----------|---|---|---|---|---|---|---|-------|
| W-1 | APE | APE | APE | APE | APE | APE | APE | **LIB** | 42h |
| W-2 | APE | APE | **LIB** | APE | APE | APE | APE | APE | 42h |
| W-3 | APE | APE | APE | **LIB** | APE | APE | APE | APE | 42h |
| W-4 | CIE | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | 42h |
| W-5 | CIE | **LIB** | CIE | CIE | CIE | CIE | CIE | CIE | 42h |

*Cobertura por día (semana A):*

| Día | APE | CIE | OK |
|-----|-----|-----|----|
| L | W1, W2, W3 (3) | W5 (1) | ✓ |
| M | W1, W3 (2) | W4, W5 (2) | ✓ |
| X | W1, W2 (2) | W4, W5 (2) | ✓ |
| J | W2, W3 (2) | W5 (1) | ✓ |
| V | W2, W3 (2) | W4, W5 (2) | ✓ |
| S | W2, W3 (2) | W4, W5 (2) | ✓ |
| D | W2, W3 (2) | W4, W5 (2) | ✓ |

Mínimo: 1 APE + 1 CIE siempre presente ✓

**Veredicto: ✓ FACTIBLE MÍNIMO** — viable con rotación. Frágil en meses de 5 domingos sin rotativo.

---

### N = 6

**Distribución:** 3 APE + 3 CIE

**Cobertura:** ≥3 de cada tipo → días libres distintos → siempre ≥2 de cada tipo la mayoría de los días, ≥1 garantizado ✓

**Horas:** 42h ✓

**Domingos:**
- Slots APE: 3 × 2 = 6. Necesarios (4 dom): 4. Margen: **+2**
- Slots CIE: 3 × 2 = 6. Necesarios: 4. Margen: **+2**
- En mes de 5 domingos: slots = 6 ≥ 5 ✓ para ambos tipos. Margen: **+1** ✓

**Consecutivos:** max 6 con planificación correcta ✓

**Plantilla semanal:**

| Worker | Turno | L | M | X | J | V | S | D | Horas |
|--------|-------|---|---|---|---|---|---|---|-------|
| APE-1 | APE | APE | APE | APE | APE | APE | APE | **LIB** | 42h |
| APE-2 | APE | APE | APE | APE | APE | APE | **LIB** | APE | 42h |
| APE-3 | APE | APE | APE | APE | APE | **LIB** | APE | APE | 42h |
| CIE-1 | CIE | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | 42h |
| CIE-2 | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | CIE | 42h |
| CIE-3 | CIE | CIE | **LIB** | CIE | CIE | CIE | CIE | CIE | 42h |

*Cobertura por día:*

| Día | APE | CIE | Cobertura |
|-----|-----|-----|-----------|
| L | 3 | 3 | ✓ excelente |
| M | 3 | 2 | ✓ |
| X | 3 | 2 | ✓ |
| J | 3 | 2 | ✓ |
| V | 2 | 3 | ✓ |
| S | 2 | 3 | ✓ |
| D | 2 | 3 | ✓ |

Mínimo diario: 2 APE + 2 CIE = 4 trabajadores simultáneos ✓

*Distribución dominical mensual:*

| Domingo | APE | CIE | Nota |
|---------|-----|-----|------|
| Dom 1 | APE-1, APE-2 | CIE-1, CIE-2 | 2 APE + 2 CIE |
| Dom 2 | APE-3 | CIE-3 | 1 APE + 1 CIE (mínimo) |
| Dom 3 | APE-1, APE-3 | CIE-2, CIE-3 | 2 APE + 2 CIE |
| Dom 4 | APE-2 | CIE-1 | 1 APE + 1 CIE (mínimo) |

Cada APE trabaja max 2 domingos ✓. Cada CIE max 2 domingos ✓. Margen de 2 slots por tipo.

**Veredicto: ✓ FACTIBLE SÓLIDO** — primera dotación con margen real para gestionar ausencias. Recomendada como mínimo operativo para una sucursal mall activa.

---

### N = 7

**Distribución:** 4 APE + 3 CIE (o 3 APE + 4 CIE)

**Domingos:**
- Slots APE (4 workers): 8. Necesarios: 4. Margen: **+4**
- Slots CIE (3 workers): 6. Necesarios: 4. Margen: **+2**
- Mes 5 domingos: APE 8 ≥ 5 ✓, CIE 6 ≥ 5 ✓

**Cobertura mínima:** 3 APE + 2 CIE en el peor día (cuando cada grupo tiene 1 libre) ✓

**Consecutivos:** max 6 con planificación ✓

**Horas:** 42h ✓

**Plantilla semanal (4 APE + 3 CIE):**

| Worker | Turno | L | M | X | J | V | S | D | Horas |
|--------|-------|---|---|---|---|---|---|---|-------|
| APE-1 | APE | APE | APE | APE | APE | APE | APE | **LIB** | 42h |
| APE-2 | APE | APE | APE | APE | APE | APE | **LIB** | APE | 42h |
| APE-3 | APE | APE | APE | APE | APE | **LIB** | APE | APE | 42h |
| APE-4 | APE | APE | APE | APE | **LIB** | APE | APE | APE | 42h |
| CIE-1 | CIE | CIE | CIE | CIE | CIE | CIE | **LIB** | CIE | 42h |
| CIE-2 | CIE | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | 42h |
| CIE-3 | CIE | **LIB** | CIE | CIE | CIE | CIE | CIE | CIE | 42h |

*Cobertura:*

| Día | APE | CIE | Total presentes |
|-----|-----|-----|-----------------|
| L | 4 | 2 | 6 |
| M | 4 | 2 | 6 |
| X | 4 | 3 | 7 |
| J | 3 | 2 | 5 |
| V | 3 | 3 | 6 |
| S | 3 | 3 | 6 |
| D | 3 | 3 | 6 |

Mínimo: 3+2 = 5 trabajadores ✓

**Veredicto: ✓ FACTIBLE SÓLIDO** — buena holgura. Permite absorber ausencias sin comprometer cobertura.

---

### N = 8

**Distribución:** 4 APE + 4 CIE

**Domingos:**
- Slots: 8 cada tipo. Necesarios: 4 cada tipo. Margen: **+4 cada tipo**
- Mes 5 dom: 8 ≥ 5 ✓. Margen: +3

**Cobertura mínima:** 3 APE + 3 CIE en el peor día ✓ (≥6 personas siempre)

**Plantilla semanal:**

| Worker | Turno | L | M | X | J | V | S | D | Horas |
|--------|-------|---|---|---|---|---|---|---|-------|
| APE-1 | APE | APE | APE | APE | APE | APE | APE | **LIB** | 42h |
| APE-2 | APE | APE | APE | APE | APE | APE | **LIB** | APE | 42h |
| APE-3 | APE | APE | APE | APE | APE | **LIB** | APE | APE | 42h |
| APE-4 | APE | APE | APE | APE | **LIB** | APE | APE | APE | 42h |
| CIE-1 | CIE | CIE | CIE | CIE | CIE | CIE | **LIB** | CIE | 42h |
| CIE-2 | CIE | CIE | CIE | CIE | CIE | **LIB** | CIE | CIE | 42h |
| CIE-3 | CIE | CIE | CIE | **LIB** | CIE | CIE | CIE | CIE | 42h |
| CIE-4 | CIE | **LIB** | CIE | CIE | CIE | CIE | CIE | CIE | 42h |

Cobertura mínima: 3+3 = 6 presentes en el peor día ✓

**Veredicto: ✓ FACTIBLE SÓLIDO** — operación cómoda, permite planificar vacaciones con reemplazo.

---

### N = 9

**Distribución:** 5 APE + 4 CIE

**Domingos:** slots APE=10, CIE=8. Necesarios: 4 cada tipo. Margen: APE +6, CIE +4. Mes 5 dom: APE ✓ (+5), CIE ✓ (+3).

**Cobertura mínima:** 4 APE + 3 CIE = 7 personas en el peor día.

**Nota operativa:** con 9 trabajadores, 2 de cada tipo pueden tener el mismo día libre sin comprometer la cobertura (siempre quedan 3+ de cada tipo).

**Veredicto: ✓ FACTIBLE SÓLIDO** — permite vacaciones escalonadas y absorber bajas.

---

### N = 10

**Distribución:** 5 APE + 5 CIE

**Domingos:** slots 10 de cada tipo. Necesarios: 4. Margen: **+6 cada tipo**.

**Cobertura mínima:** 4+4 = 8 personas en el peor día.

**Holgura dominical:** sobran 6 slots por tipo → cada trabajador puede trabajar incluso 0, 1 o 2 domingos, con flexibilidad total.

**Veredicto: ✓ FACTIBLE HOLGADO** — zona de confort operativo. Adecuado para sucursales de alto tráfico que requieren mayor cobertura simultánea.

---

### N = 11

**Distribución:** 6 APE + 5 CIE

**Domingos:** APE=12, CIE=10. Necesarios: 4. Margen: APE +8, CIE +6.

**Cobertura mínima:** 5 APE + 4 CIE = 9 personas en el peor día.

**Veredicto: ✓ FACTIBLE HOLGADO** — alta redundancia. Útil si la sucursal tiene alta rotación o se planea crecer.

---

### N = 12

**Distribución:** 6 APE + 6 CIE

**Domingos:** slots 12 de cada tipo. Margen: **+8 cada tipo**.

**Cobertura mínima:** 5+5 = 10 personas en el peor día.

**Veredicto: ✓ FACTIBLE HOLGADO** — máximo analizado. Cobertura excelente todos los días. Corresponde a una sucursal de alta dotación con turnos solapados significativos.

---

## 6. Tabla resumen por dotación

| N | Distribución | Cobertura | 42h | Dom 4S | Dom 5S | Margen APE | Margen CIE | Cob. mínima/día | Estado |
|---|-------------|-----------|-----|--------|--------|-----------|-----------|-----------------|--------|
| 2 | 1A+1C | ✗ | ✓ | ✗ | ✗ | -2 | -2 | 0+0 | ✗ INFACTIBLE |
| 3 | 2A+1C | ✗ | ✓ | ✗ | ✗ | 0 | -2 | 1+0 | ✗ INFACTIBLE |
| 4 | 2A+2C | ✓ | ✓ | ✓ | ✗ | 0 | 0 | 1+1 | ⚠ AJUSTADO |
| 5 | 3A+2C (rot) | ✓ | ✓ | ✓ | ✗ | +2 | 0 | 1+1 | ✓ MÍNIMO |
| **6** | **3A+3C** | **✓** | **✓** | **✓** | **✓** | **+2** | **+2** | **2+2** | **✓ SÓLIDO** |
| 7 | 4A+3C | ✓ | ✓ | ✓ | ✓ | +4 | +2 | 3+2 | ✓ SÓLIDO |
| 8 | 4A+4C | ✓ | ✓ | ✓ | ✓ | +4 | +4 | 3+3 | ✓ SÓLIDO |
| 9 | 5A+4C | ✓ | ✓ | ✓ | ✓ | +6 | +4 | 4+3 | ✓ SÓLIDO |
| 10 | 5A+5C | ✓ | ✓ | ✓ | ✓ | +6 | +6 | 4+4 | ✓ HOLGADO |
| 11 | 6A+5C | ✓ | ✓ | ✓ | ✓ | +8 | +6 | 5+4 | ✓ HOLGADO |
| 12 | 6A+6C | ✓ | ✓ | ✓ | ✓ | +8 | +8 | 5+5 | ✓ HOLGADO |

*A = APE, C = CIE. Margen = slots domingos disponibles − slots necesarios (meses de 4 domingos).*

---

## 7. Problema con los solvers actuales

El documento `optimizer-lab-factibilidad-base-mayo-2026.md` identifica que en la implementación actual el máximo de días consecutivos reportado en las propuestas es de **7-9 días**, violando la restricción de 6.

**Causa raíz:** el solver trabaja con semanas como unidades independientes. No modela el **cruce entre la semana N y la semana N+1**. Un trabajador puede terminar la semana N trabajando 6 días (Lun-Sáb, o Jue-Dom), y empezar la semana N+1 también sin día libre hasta 3 o 4 días → racha de 9-10 en el papel.

**Requisito para el solver:** la restricción de consecutivos debe evaluarse en ventana deslizante de 7 días, no dentro de semanas ISO.

Formalmente: `∀ ventana [d, d+6]: sum(y_worker_d') ≤ 6 para todo d' ∈ [d, d+6]`

Esto es distinto de: `∀ semana_ISO: sum(y_worker) ≤ 6`

---

## 8. Esquema recomendado por dotación

| Dotación | Esquema | Razón |
|----------|---------|-------|
| 4 | E-A (APE+CIE fijo) | Más simple. Poco margen → planificación manual de domingos obligatoria. |
| 5 | E-B (Rotativo semanal) | Elimina asimetría de grupos. Distribución más justa de domingos. |
| 6 | E-B (Rotativo semanal) | Primer punto sólido. Rotativo mejora equidad sin costo de factibilidad. |
| 7-8 | E-B o E-A | Ambos funcionan bien. E-B si el equipo valora la equidad de horario. |
| 9-10 | E-B o E-D (Mixto) | Con 9+ se puede introducir 1 COM worker para tener cobertura total sin depender del par APE+CIE. |
| 11-12 | E-D (Mixto) | Com workers como base + APE/CIE como refuerzo en franjas. Máxima flexibilidad de planning. |

---

## 9. Próximos pasos

1. **Corregir restricción consecutivos en el solver:** implementar ventana deslizante de 7 días en lugar de semana ISO. Sin esto, ninguna propuesta del solver es operativamente válida.

2. **Correr barrido con E-A y E-B** una vez corregido el solver: comparar calidad de propuestas entre esquema fijo y rotativo.

3. **Validar planilla mensual para N=6** como caso piloto: generar calendario real para mayo 2026 con 3 APE + 3 CIE, verificar que todos los domingos quedan cubiertos y ningún trabajador supera 6 días consecutivos.

4. **Definir política de ausencias:** con N=6 el margen es +2 slots por tipo de turno. Si hay una ausencia en un domingo, ¿quién cubre? Debe haber protocolo de reemplazo documentado.

5. **Evaluar Esquema D (Mixto con COM)** para dotaciones ≥8: puede dar mayor cobertura en horarios pico (12:00-18:00 con 3 workers) manteniendo el cierre asegurado por el COM worker.
