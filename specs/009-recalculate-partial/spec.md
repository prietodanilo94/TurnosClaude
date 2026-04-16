# Spec 009 — Recalcular Parcial (Rango de Fechas con Dotación Reducida)

## Contexto

Escenario real: ya se generó y aprobó el turnero del mes, pero surge un imprevisto — un trabajador renuncia, otro pide vacaciones de última hora, etc. Necesitamos **recalcular solo un rango de fechas** con la dotación efectivamente disponible, sin tirar abajo el trabajo ya hecho.

## Objetivo

Desde el calendario, el admin puede:
1. Seleccionar un rango de fechas del mes (ej: 15 al 30 de mayo).
2. Seleccionar qué trabajadores están disponibles en ese rango (puede excluir uno o varios).
3. Ejecutar una optimización **solo para ese rango**, manteniendo intactas las asignaciones fuera del rango.
4. Revisar el resultado y aprobar o descartar.

## Flujo

### Paso 1 — Abrir el panel de recálculo parcial

En la vista del calendario (Spec 004), botón "Recalcular parcial".

### Paso 2 — Seleccionar rango y dotación

```
┌─────────────────────────────────────────────────────┐
│ Recalcular parcial                                  │
│                                                     │
│ Rango:   Desde [15/05/2026]  Hasta [30/05/2026]    │
│                                                     │
│ Dotación disponible en el rango:                    │
│  ✓ ABARZUA VARGAS ANDREA                            │
│  ✓ ABUHADBA MOENA LUCAS                             │
│  ✗ ACKERKNECHT DEL POZO GERT  (deshabilitar)        │
│  ✓ ...                                              │
│                                                     │
│ Modo: [● ILP   ○ Greedy]                            │
│                                                     │
│            [Cancelar]  [Calcular propuesta]         │
└─────────────────────────────────────────────────────┘
```

### Paso 3 — Backend resuelve solo ese rango

El backend recibe un payload especial con:
- `partial_range: { desde, hasta }`
- `assignments_fijas`: las asignaciones fuera del rango (de la propuesta base) que NO se deben tocar.
- `workers`: la dotación del rango (filtrada).

El solver opera solo sobre las variables $x_{w,d,s}$ con $d \in [\text{desde}, \text{hasta}]$, tratando el resto como **constantes**. Las restricciones semanales de 42 h y 6 días siguen aplicando, incluyendo las horas que los trabajadores ya tienen asignadas fuera del rango (dentro de las semanas que se intersectan con el rango).

### Paso 4 — Comparar y aprobar

Se muestra el calendario con:
- Días dentro del rango en color "modificado".
- Días fuera del rango atenuados (no se tocaron).
- Comparación opcional "antes / después" de los slots modificados.

Botón "Aprobar" → sobrescribe las asignaciones del rango en la propuesta activa.
Botón "Descartar" → vuelve al estado anterior.

## Caso importante: semanas parciales

Si el rango empieza un miércoles, la semana anterior tiene turnos de lunes y martes que SÍ cuentan para las 42h de esa semana. El solver debe:
- Contar las horas ya asignadas de lun-mar como "consumidas".
- Restar del máximo disponible para mié-dom dentro del rango.

Formalmente, para cada semana $\text{wk}$ que se intersecta con el rango:

$$
\sum_{d \in \text{wk} \cap [\text{desde},\text{hasta}]} \sum_s \text{dur}(s) \cdot x_{w,d,s} \le 42 - H^{\text{fija}}_{w,\text{wk}}
$$

Donde $H^{\text{fija}}_{w,\text{wk}}$ son las horas del trabajador $w$ en la semana $\text{wk}$ que caen **fuera** del rango de recálculo.

## Criterios de aceptación

- [ ] El admin puede seleccionar rango y dotación desde la UI.
- [ ] El backend resuelve solo el rango, respetando las horas ya asignadas fuera.
- [ ] El resultado se muestra visualmente diferenciando los días modificados.
- [ ] Al aprobar, solo se modifican las asignaciones del rango.
- [ ] Al descartar, nada cambia.
- [ ] Queda registrado en `audit_log` con metadata del rango y trabajadores excluidos.
