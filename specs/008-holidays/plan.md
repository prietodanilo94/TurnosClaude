# Plan — Spec 008

## Archivos

```
frontend/src/
├── app/admin/feriados/page.tsx
├── app/admin/feriados/components/
│   ├── HolidaysList.tsx
│   └── NewHolidayDialog.tsx
├── lib/holidays/
│   ├── api.ts
│   └── is-holiday.ts

scripts/
└── seed-holidays.ts                   ← actualizado (ya creado en spec 001)
```

## Decisiones

- Los feriados son pocos (≈4 por año) → no preocuparse por paginación.
- Una sola tabla `holidays` que mezcla todos los años. Filtros por año/mes en queries.
- Día de elecciones se agrega a mano porque la fecha exacta depende del gobierno.
