# Spec 004 — Optimizer v2

## Contexto

El motor de optimización reutiliza el ILP (OR-Tools CP-SAT) de v1. Los cambios son:

1. **Entrada por rotation_group**: el solver recibe los turnos ya filtrados para el grupo de esa sucursal × área de negocio.
2. **Mall 7 días**: nueva lógica para sucursales que abren domingo con 3 tipos de turno (APE, CIE, COM).
3. **Balance de tipos de turno**: el objetivo incluye un término nuevo que premia distribuir equitativamente los tipos de turno (no solo las horas).

## Endpoints (sin cambios en firma, cambios internos)

- `POST /optimize` — igual que v1, pero ahora el payload incluye `rotation_group`.
- `POST /optimize/partial` — igual que v1.
- `POST /validate` — igual que v1.
- `POST /export` — igual que v1.

## Cambios en el payload

```json
{
  "branch_id": "...",
  "rotation_group": "V_M7",
  "workers": [...],
  "shifts": [...],        // ya filtrados por rotation_group
  "month": 5,
  "year": 2026,
  "holidays": [...],
  "parametros": {...}
}
```

## Restricciones nuevas (Mall 7 días)

### R_NEW_1: Máximo 5 días trabajados por semana (solo V_M7)

Para cada worker en sucursales V_M7:

$$\sum_{d \in \text{wk}} y_{w,d} \le 5 \quad \forall w, \forall \text{wk}$$

> En v1 el límite era 6. Para Mall 7d bajamos a 5 para garantizar 2 libres/semana.

### R_NEW_2: Exactamente 42h semanales (solo V_M7, semanas completas)

La combinación de APE (8h) y COM (9h) debe sumar exactamente 42h en semanas completas:

$$\sum_{d \in \text{wk}} \sum_{s \in S} \text{dur}(s) \cdot x_{w,d,s} = 42 \quad \forall w, \forall \text{wk completa}$$

### R_NEW_3: Mínimo turnos COM por semana (solo V_M7)

Para lograr 42h con 5 días, cada worker debe tener al menos 2 turnos COM por semana:

$$\sum_{d \in \text{wk}} x_{w,d,\text{COM}} \ge 2 \quad \forall w, \forall \text{wk}$$

## Función objetivo — nuevo término de balance de tipos

Se agrega $Z_{\text{tipo\_balance}}$ que penaliza que un worker haga siempre el mismo tipo de turno:

$$Z_{\text{tipo\_balance}} = -\sum_{w} \left| \text{count\_APE}(w) - \text{count\_CIE}(w) \right|$$

Peso: $\epsilon = 2$ (bajo, para no interferir con los objetivos principales).

## Parámetros nuevos (solo Mall 7d)

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `max_dias_semana` | 5 (V_M7) / 6 (resto) | Días máximos por semana |
| `horas_semanales_min` | 42 | Horas mínimas (semanas completas, V_M7) |
| `peso_tipo_balance` | 2 | Peso del balance APE/CIE |

## Criterios de aceptación

- [ ] El endpoint `/optimize` acepta el campo `rotation_group` en el payload.
- [ ] Para V_M7: restricción de 5 días/semana activa.
- [ ] Para V_M7: la mezcla APE+CIE+COM suma 42h por semana.
- [ ] Para todos: al menos 2 domingos libres al mes (cuando aplica).
- [ ] El balance de tipos APE/CIE está en la función objetivo.
- [ ] Tests: `test_optimizer_vm7.py` con al menos 6 casos (infactible, factible, domingos libres, balance, etc.).
