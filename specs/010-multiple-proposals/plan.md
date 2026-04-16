# Plan — Spec 010

## Archivos

```
frontend/src/
├── app/
│   ├── admin/sucursales/[branchId]/mes/[year]/[month]/propuestas/
│   │   ├── page.tsx                      ← Grid de propuestas con cards
│   │   └── comparar/page.tsx             ← Vista lado-a-lado
│   └── jefe/sucursales/[branchId]/mes/[year]/[month]/
│       └── seleccionar/page.tsx          ← Selección para jefe
├── features/proposals/
│   ├── ProposalCard.tsx
│   ├── ProposalMetrics.tsx
│   ├── ProposalCompareView.tsx
│   └── PublishDialog.tsx
└── lib/proposals/
    ├── api.ts                            ← CRUD + cambios de estado
    ├── metrics.ts                        ← Cálculo de métricas client-side
    └── state-machine.ts                  ← Transiciones de estado
```

## State machine

```
generada ───(publicar)──→ publicada ───(seleccionar)──→ seleccionada
    │                         │                              │
    │                         │                              ├──(exportar)──→ exportada
    │                         │                              │
    ▼                         ▼                              ▼
descartada                descartada                    descartada

Reglas:
- seleccionar: fuerza DESCARTADA en todas las otras de (branch, mes)
- Transición solo permitida según rol:
  - publicar / descartar: admin
  - seleccionar: admin o jefe (si está publicada)
  - exportar: admin o jefe (si está seleccionada)
```

## Métricas

Calculadas server-side al generar la propuesta y guardadas en el doc para no recomputar.

```ts
interface ProposalMetrics {
  score: number
  horas_promedio: number
  desviacion_horas: number
  cobertura_peak_pct: number
  turnos_cortos_count: number
  fin_semana_completo_count: number
}
```

Se incluyen en la respuesta de `/optimize` y se guardan en `proposals.metrics` (atributo JSON).

## Comparador

Muestra dos propuestas lado a lado:
- Calendarios mini (sin drag, solo lectura).
- Tabla comparativa de métricas con highlight del mejor en cada fila.

## Riesgo: race conditions

Si dos jefes (o admin y jefe) intentan seleccionar simultáneamente:
- Usamos una query condicional en Appwrite (update con filter) para que solo 1 tenga éxito.
- El perdedor recibe error "Otro usuario ya seleccionó una propuesta. Recarga para ver el estado actual."
