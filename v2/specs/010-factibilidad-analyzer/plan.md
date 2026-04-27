# Plan - Spec 010

## Enfoque implementado

Se opto por una vista exploratoria desacoplada de Appwrite y del calendario mensual real.

Razones:

- el problema principal era de analisis y comparacion, no de persistencia,
- negocio necesitaba iterar rapido sobre patrones posibles,
- la matematica de consecutivos debia quedar visible y confiable,
- mezclar esto con propuesta real de sucursal habria aumentado mucho la complejidad de la primera entrega.

## Arquitectura

### UI

- `src/app/admin/factibilidad/page.tsx`
- `src/app/admin/factibilidad/FactibilidadPageClient.tsx`

### Motor

- `src/lib/factibilidad/types.ts`
- `src/lib/factibilidad/scenarios.ts`
- `src/lib/factibilidad/analyzer.ts`

### Regla compartida corregida

- `src/lib/calendar/consecutive-days.ts`
- `src/lib/calendar/local-validator.ts`

## Decision importante

La vista actual no intenta fabricar una "factibilidad perfecta" para todas las dotaciones.

En especial para N pequenos, el motor conserva la cobertura base pero deja visibles las
tensiones de domingos y consecutivos. Eso es intencional: la herramienta debe ayudar a
detectar fragilidad, no a esconderla.

## Pendientes tecnicos

- parametrizar el analizador por calendario real,
- modelar `COM` con turno corto complementario,
- persistir escenarios,
- conectar con datos reales de sucursal.
