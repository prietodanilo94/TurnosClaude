# Formulación matemática del optimizador

Este documento describe la formulación **ILP (Integer Linear Programming)** que resolverá OR-Tools (módulo CP-SAT), y también la **heurística greedy** que se ofrece como modo alternativo.

> Este documento es la fuente de verdad matemática del optimizador. Cualquier cambio en reglas de negocio debe reflejarse aquí **antes** de tocar código.

---

## 1. Conjuntos (sets)

| Símbolo  | Significado                              | Ejemplo                                              |
|----------|------------------------------------------|------------------------------------------------------|
| $W$      | Trabajadores disponibles en la sucursal  | $\{w_1, w_2, \ldots, w_n\}$ con $n = \|W\|$          |
| $D$      | Días del mes objetivo                    | $\{1, 2, \ldots, 28/29/30/31\}$                      |
| $S$      | Catálogo de turnos aplicables al tipo de franja | $\{s_1, \ldots, s_k\}$ (ej: 10:00–20:00, …)    |
| $S^{*}$  | $S \cup \{\emptyset\}$, donde $\emptyset$ = "libre" | Permite que un trabajador no tenga turno ese día |
| $H$      | Feriados irrenunciables dentro de $D$    | $H \subseteq D$                                      |
| $\text{WK}$ | Semanas ISO dentro del mes (lunes-domingo) | $\{1, 2, 3, 4, 5\}$ — algunas semanas parciales   |

### Atributos derivados

- $\text{dur}(s)$: duración efectiva del turno $s$ en horas, ya descontada la colación si corresponde.
- $\text{inicio}(s)$, $\text{fin}(s)$: en minutos desde 00:00.
- $\text{dia\_semana}(d) \in \{L, Ma, Mi, J, V, S, Dom\}$: día de la semana del día $d$.
- $\text{abierto}(d) \in \{0, 1\}$: 1 si la sucursal abre ese día (considera el tipo de franja y excluye feriados $H$).
- $\text{apertura}(d)$, $\text{cierre}(d)$: franja horaria en minutos para el día $d$.

### Restricciones por trabajador (vienen del payload)

Para cada $w \in W$:
- $\text{vacaciones}(w) \subseteq D$: días en que $w$ no puede trabajar.
- $\text{dia\_prohibido}(w) \subseteq \{L, Ma, \ldots, Dom\}$: días de la semana prohibidos.
- $\text{turno\_prohibido}(w) \subseteq S$: turnos específicos que no puede hacer.

---

## 2. Variables de decisión

La variable principal es binaria:

$$
x_{w,d,s} \in \{0, 1\} \quad \forall w \in W, d \in D, s \in S
$$

$x_{w,d,s} = 1$ si el trabajador $w$ hace el turno $s$ el día $d$.

### Variables auxiliares

**Día trabajado** (deducible de $x$, pero explícito ayuda al solver):

$$
y_{w,d} = \sum_{s \in S} x_{w,d,s} \in \{0, 1\}
$$

**Cobertura por minuto** (para restricción de mínimo simultáneo). Discretizamos el día en intervalos de 30 minutos $T = \{t_0, t_1, \ldots\}$. Para cada $(d, t)$:

$$
c_{d,t} = \sum_{w \in W} \sum_{s \in S : \text{inicio}(s) \le t < \text{fin}(s)} x_{w,d,s}
$$

**Domingo libre** (para la regla de dos domingos libres al mes). Sea $\text{Dom}(d) = 1$ si $d$ es domingo:

$$
\text{dom\_libre}_{w,d} = \text{Dom}(d) \cdot (1 - y_{w,d})
$$

---

## 3. Restricciones (constraints)

### 3.1. Un trabajador hace máximo un turno por día

$$
\sum_{s \in S} x_{w,d,s} \le 1 \quad \forall w \in W, \forall d \in D
$$

### 3.2. Días cerrados: nadie trabaja

$$
x_{w,d,s} = 0 \quad \forall w, \forall s, \forall d \text{ tal que } \text{abierto}(d) = 0
$$

Esto cubre automáticamente:
- Domingos en Standalone y AutoPark.
- Feriados irrenunciables en todas las sucursales.

### 3.3. Turnos prohibidos individuales

$$
x_{w,d,s} = 0 \quad \forall w, \forall d, \forall s \in \text{turno\_prohibido}(w)
$$

### 3.4. Días prohibidos individuales

$$
y_{w,d} = 0 \quad \forall w, \forall d \text{ tal que } \text{dia\_semana}(d) \in \text{dia\_prohibido}(w)
$$

### 3.5. Vacaciones

$$
y_{w,d} = 0 \quad \forall w, \forall d \in \text{vacaciones}(w)
$$

### 3.6. Máximo 42 horas semanales

Para cada trabajador $w$ y cada semana $\text{wk} \in \text{WK}$:

$$
\sum_{d \in \text{wk}} \sum_{s \in S} \text{dur}(s) \cdot x_{w,d,s} \le 42
$$

> **Nota**: $\text{dur}(s)$ ya tiene descontada la hora de colación para turnos $\ge 6$ h. Turnos de 4 o 5 h no descuentan colación.

### 3.7. Máximo 6 días trabajados por semana

$$
\sum_{d \in \text{wk}} y_{w,d} \le 6 \quad \forall w, \forall \text{wk}
$$

### 3.8. Al menos 2 domingos libres al mes (solo si la sucursal abre domingos)

$$
\sum_{d \in D : \text{Dom}(d) = 1} \text{dom\_libre}_{w,d} \ge 2 \quad \forall w \in W
$$

Si el mes tiene menos de 4 domingos abiertos, esta restricción se relaja proporcionalmente. En un mes con $k$ domingos abiertos, se exige $\min(2, k-1)$ libres (nunca menos de 1).

### 3.9. Cobertura mínima: al menos 1 persona en todo momento abierto

$$
c_{d,t} \ge 1 \quad \forall d \text{ con } \text{abierto}(d) = 1, \forall t \in [\text{apertura}(d), \text{cierre}(d))
$$

### 3.10. Descanso mínimo entre jornadas (opcional, 10 horas)

> Esta restricción se puede activar/desactivar vía parámetro. Por defecto **desactivada** porque el usuario confirmó que los turnos actuales no generan conflictos.

Si $x_{w,d,s_1} = 1$ y $x_{w,d+1,s_2} = 1$:
$$
\text{apertura del día } d+1 + \text{inicio}(s_2) - (\text{apertura del día } d + \text{fin}(s_1)) \ge 600 \text{ minutos}
$$

Expresado como restricción lineal:
$$
x_{w,d,s_1} + x_{w,d+1,s_2} \le 1 \quad \forall (s_1, s_2) \text{ tal que } \text{fin}(s_1) + 600 > 1440 + \text{inicio}(s_2)
$$

---

## 4. Función objetivo

La función objetivo combina múltiples términos con pesos configurables. Queremos **maximizar**:

$$
Z = \alpha \cdot Z_{\text{cobertura\_peak}} + \beta \cdot Z_{\text{finde}} + \gamma \cdot Z_{\text{balance}} - \delta \cdot Z_{\text{ociosidad}}
$$

Con pesos por defecto: $\alpha = 10$, $\beta = 5$, $\gamma = 3$, $\delta = 1$.

### 4.1. $Z_{\text{cobertura\_peak}}$: premia dotación extra en horario peak

Para todo $(d, t)$ con $t \ge \text{peak\_desde}$ (default 17:00):

$$
Z_{\text{cobertura\_peak}} = \sum_{d \in D} \sum_{t \ge \text{peak\_desde}} \min(c_{d,t}, C_{\max})
$$

Donde $C_{\max}$ evita sobre-recompensar saturaciones. Default: $C_{\max} = 3$.

### 4.2. $Z_{\text{finde}}$: premia dotación en fines de semana

$$
Z_{\text{finde}} = \sum_{d \in D : \text{dia\_semana}(d) \in \{S, Dom\}} \sum_{w \in W} y_{w,d}
$$

### 4.3. $Z_{\text{balance}}$: premia que todos los trabajadores hagan horas similares

Definimos $H_w = \sum_{d \in D} \sum_{s \in S} \text{dur}(s) \cdot x_{w,d,s}$ como horas totales del trabajador $w$ en el mes.

Minimizar la desviación absoluta respecto al promedio:

$$
Z_{\text{balance}} = - \sum_{w \in W} |H_w - \bar{H}|
$$

En ILP esto se linealiza introduciendo variables auxiliares $u_w^+, u_w^- \ge 0$ con $u_w^+ - u_w^- = H_w - \bar{H}$, y se suma $-(u_w^+ + u_w^-)$.

### 4.4. $Z_{\text{ociosidad}}$: penaliza minutos cubiertos con más personas de las necesarias cuando ya hay suficientes

Esto evita que todos estén siempre, dejando respiros para que las horas cuadren bien.

$$
Z_{\text{ociosidad}} = \sum_{d,t} \max(0, c_{d,t} - C^{*}_{d,t})^2
$$

Donde $C^{*}_{d,t}$ es la cobertura óptima deseada (configurable; default = 2 en peak, 1 fuera de peak). La expresión cuadrática se linealiza con restricciones auxiliares.

---

## 5. Cálculo de dotación mínima requerida

**Antes de resolver el ILP completo**, el optimizador corre una rutina de **lower bound** que calcula la dotación mínima teóricamente necesaria para cubrir el mes sin violar las 42 h semanales:

$$
n_{\min} = \left\lceil \frac{\sum_{d \in D : \text{abierto}(d)=1} (\text{cierre}(d) - \text{apertura}(d))}{42 \cdot |\text{WK}|} \right\rceil
$$

Donde el numerador son las horas totales que hay que cubrir en el mes (asumiendo 1 persona mínimo en todo momento) y el denominador son las horas máximas que puede aportar una persona en el mes.

El sistema devuelve:
- $n_{\min}$: mínimo teórico.
- $|W|$: dotación real disponible.
- Flag `dotacion_suficiente` = $|W| \ge n_{\min}$.

Si $|W| < n_{\min}$ se retorna inmediatamente un error explícito **sin ejecutar el ILP**: "Necesitas al menos $n_{\min}$ trabajadores para cubrir esta sucursal este mes; tienes $|W|$."

---

## 6. Generación de múltiples propuestas

Para obtener las $N$ mejores propuestas (default $N=3$):

### Opción A — K-best con restricción de diversidad (recomendada)

Resolver el ILP una primera vez. Obtener la solución $x^*_1$. Agregar al modelo una restricción de distancia Hamming mínima:

$$
\sum_{w,d,s} |x_{w,d,s} - x^*_{1,w,d,s}| \ge K_{\text{div}}
$$

Donde $K_{\text{div}}$ es un umbral de diversidad (ej: 15% de las variables diferentes). Resolver de nuevo. Repetir hasta obtener $N$ propuestas o hasta que el modelo sea infactible.

### Opción B — Perturbación de pesos

Ejecutar el solver $N$ veces con pequeñas perturbaciones aleatorias en los pesos $\alpha, \beta, \gamma, \delta$. Simple y rápido, pero no garantiza diversidad.

**Implementación inicial**: Opción B (simple). Opción A como mejora futura.

---

## 7. Heurística Greedy (modo alternativo)

Para el modo `greedy` usamos un algoritmo constructivo rápido:

```
Entrada: workers W, días D, turnos S, franja por día, feriados H
Salida: asignaciones

1. Ordenar días del mes: primero sábados y domingos, luego viernes, luego resto.
   (Rationale: los días de alta demanda se llenan primero mientras hay más libertad.)

2. Inicializar horas_semana[w][wk] = 0 para todo w, wk.
   Inicializar dias_trabajados[w][wk] = 0.
   Inicializar domingos_libres[w] = 0 (contamos los ya libres).
   Inicializar asignaciones = [].

3. Para cada día d en orden:
   Si no abierto(d): continuar.
   Calcular turnos necesarios para cubrir la franja del día con mínimo 1 persona simultánea.
   Seleccionar combinación minimal de turnos que cubra la franja (greedy cover).

   Para cada turno necesario:
     Entre los W que:
       - no están de vacaciones en d
       - no tienen d prohibido por día de la semana
       - no tienen ese turno prohibido
       - horas_semana[w][wk(d)] + dur(s) <= 42
       - dias_trabajados[w][wk(d)] < 6
       - si d es domingo: validar que no rompa la regla de 2 domingos libres
     Escoger el w que:
       a) minimice horas_semana[w][wk(d)]  (balance)
       b) en empate, maximice su disponibilidad futura

   Asignar y actualizar contadores.

4. Validar solución final. Si algún día quedó descubierto → reportar infactibilidad.
```

**Complejidad**: $O(|D| \cdot |S| \cdot |W|)$ — muy rápido (~ms) incluso con decenas de trabajadores.

**Ventaja**: siempre devuelve algo, útil cuando el ILP es infactible para debugear por qué.

**Desventaja**: no es óptimo globalmente. Puede dejar 38 h a uno y 42 a otro cuando el óptimo sería 40-40.

---

## 8. Validación post-solución

Antes de entregar la respuesta, el backend valida independientemente que la solución cumple **todas** las restricciones. Si encuentra una violación, es un bug del solver y se retorna error.

Lista de checks:
1. Ningún trabajador supera 42 h en ninguna semana.
2. Ningún trabajador trabaja más de 6 días seguidos en ninguna semana.
3. Todos los trabajadores tienen al menos 2 domingos libres (si aplica).
4. Cobertura ≥ 1 en todo momento abierto.
5. Ningún feriado irrenunciable tiene turnos asignados.
6. Ninguna vacación tiene turno asignado.
7. Ningún día prohibido individual tiene turno.
8. Ningún turno prohibido individual está asignado.

---

## 9. Parámetros del ILP (valores default)

| Parámetro                  | Default  | Descripción                                          |
|----------------------------|----------|------------------------------------------------------|
| `horas_semanales_max`       | 42       | Tope duro (constraint)                               |
| `horas_semanales_obj`       | 42       | Objetivo en la función objetivo (soft target)        |
| `dias_maximos_consecutivos` | 6        | Tope duro                                            |
| `domingos_libres_minimos`   | 2        | Tope duro (cuando aplica)                            |
| `peak_desde`                | 17:00    | Inicio del horario peak                              |
| `cobertura_minima`          | 1        | Personas mínimas simultáneas                         |
| `cobertura_optima_peak`     | 2        | Objetivo de dotación en peak                         |
| `cobertura_optima_off_peak` | 1        | Objetivo de dotación fuera de peak                   |
| `priorizar_fin_de_semana`   | true     | Activa $Z_{\text{finde}}$                            |
| `num_propuestas`            | 3        | Cantidad de soluciones a devolver                    |
| `time_limit_seconds`        | 30       | Tiempo máximo de cómputo por propuesta               |
| `descanso_entre_jornadas`   | false    | Activa restricción 3.10                              |
| `peso_cobertura_peak`       | 10       | $\alpha$                                             |
| `peso_finde`                | 5        | $\beta$                                              |
| `peso_balance`              | 3        | $\gamma$                                             |
| `peso_ociosidad`            | 1        | $\delta$                                             |

Todos editables desde la UI del admin bajo "Configuración avanzada".

---

## 10. Ejemplo mínimo (sanity check)

Sucursal tipo Standalone, 5 trabajadores, mes con 4 semanas completas (28 días).

Horas totales a cubrir:
- L-V: 5 días × 10 h × 4 semanas = 200 h
- Sábado: 4 h × 4 sábados = 16 h
- Total: **216 h**

Horas máximas por trabajador: 42 × 4 = 168 h/mes.

$n_{\min} = \lceil 216 / 168 \rceil = \lceil 1.28 \rceil = 2$ trabajadores mínimos.

Con 5 disponibles, holgura cómoda. Las horas promedio serían $216 / 5 = 43.2$ h/mes/trabajador, bien por debajo del máximo mensual.

El ILP debería converger en < 5 segundos para este caso.
