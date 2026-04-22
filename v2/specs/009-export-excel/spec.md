# Spec 009 — Exportación Excel v2

## Contexto

La exportación a Excel es similar a v1. Los cambios principales son:
1. El Excel muestra el **tipo de turno** (Apertura / Cierre / Completo / Opción A / Opción B) además del horario.
2. Los overrides aplicados (spec 007) se reflejan en el Excel exportado.
3. La columna de horas refleja las horas laborales reales (no las horas reloj).

## Formato de salida

### Encabezado del archivo

```
Turno Mensual — [Nombre Sucursal] — [Mes] [Año]
Clasificación: [Stand Alone | Mall | ...]
Área de Negocio: [Ventas | Postventa]
Generado: [fecha y hora]
```

### Estructura por trabajador

Una fila por trabajador, una columna por día del mes.

| Columna | Contenido |
|---------|-----------|
| `RUT` | RUT sin puntos ni DV |
| `Nombre` | Nombre completo |
| `Turno Base` | Tipo de turno asignado (Apertura / Cierre / etc.) |
| `[Día 1]`…`[Día N]` | Horario del turno ese día (ej: `09:00–17:30`) o `LIBRE` |
| `Horas Mes` | Total horas laborales en el mes |

### Formato de celda por día

- Turno trabajado: horario legible `HH:MM–HH:MM`.
- Día libre: `LIBRE` (fondo gris claro).
- Override aplicado: horario con asterisco `09:00–17:30 *` y nota al pie.
- Feriado: `FERIADO` (fondo naranja).
- Día cerrado: `—` (fondo gris oscuro).

## Colores de encabezado

Mismos colores del proyecto corporativo:
- Encabezado de nombre/RUT: azul oscuro (`#1E3A5F`).
- Días con turno: verde (`#2E7D32`).
- Días libres/cerrados: gris.

## Endpoint backend

`POST /export` — igual interfaz que v1, adaptado para los nuevos tipos de turno.

## Criterios de aceptación

- [ ] El Excel descargado refleja los overrides aplicados (con asterisco).
- [ ] Las horas del mes son horas laborales (colación descontada correctamente).
- [ ] Para Mall 7d: la columna domingo aparece en el Excel.
- [ ] Para sucursales cerradas el domingo: la columna domingo muestra `—`.
- [ ] El formato de celda es legible: `HH:MM–HH:MM` (no IDs internos de turno).
- [ ] Tests: `test_excel_exporter_v2.py` con al menos 5 casos.
