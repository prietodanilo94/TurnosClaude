# Spec 010 — Múltiples Propuestas y Selección por Jefe

## Contexto

Al correr el optimizador, se generan N propuestas (default 3). El admin las revisa; opcionalmente delega al jefe de sucursal la **selección** entre ellas para que él elija la que mejor le acomoda (considerando dinámicas que solo él conoce: personalidad del equipo, preferencias tácitas, etc.).

## Objetivo

1. Persistir las N propuestas generadas por ejecución.
2. Permitir al admin marcar qué propuestas "publicar" para el jefe.
3. El jefe ve las propuestas publicadas, las compara, elige una.
4. Una vez seleccionada, se convierte en la base sobre la que se asignan trabajadores reales y se exporta.

## Estados de una propuesta

```
GENERADA  →  PUBLICADA  →  SELECCIONADA  →  EXPORTADA
    ↓                          ↓
DESCARTADA                DESCARTADA
```

- `GENERADA`: recién creada por el optimizador. Solo admin la ve.
- `PUBLICADA`: admin la liberó para el jefe.
- `SELECCIONADA`: el jefe (o el admin) la eligió. Solo 1 propuesta por (branch, mes) puede estar `SELECCIONADA` a la vez.
- `EXPORTADA`: ya se descargó el xlsx (informativo; puede re-exportarse).
- `DESCARTADA`: archivada sin uso.

## UI

### Admin — después de generar

```
Propuestas generadas para NISSAN IRARRAZAVAL — Mayo 2026

┌──────────────────────┬──────────────────────┬──────────────────────┐
│ Propuesta 1 (ILP)    │ Propuesta 2 (ILP)    │ Propuesta 3 (Greedy) │
│ Score: 98.7          │ Score: 96.2          │ Score: 82.1          │
│ Horas prom/pers: 41h │ Horas prom/pers: 42h │ Horas prom/pers: 39h │
│ Balance: excelente   │ Balance: bueno       │ Balance: regular     │
│ Cobertura peak: 95%  │ Cobertura peak: 92%  │ Cobertura peak: 88%  │
│ [Ver]  [☐ Publicar]  │ [Ver]  [☐ Publicar]  │ [Ver]  [☐ Publicar]  │
└──────────────────────┴──────────────────────┴──────────────────────┘

[Publicar seleccionadas al jefe]  [Descartar todas]
```

### Jefe — al entrar al mes

```
NISSAN IRARRAZAVAL — Mayo 2026

Se publicaron 2 propuestas. Elige una para empezar a asignar.

[ Propuesta 1 ] [ Propuesta 2 ]

→ Click para ver en calendario; botón "Elegir esta" la selecciona.
```

## Comparador

Vista opcional lado-a-lado donde el admin (o el jefe) ve dos propuestas con sus calendarios y métricas, para decidir.

## Métricas por propuesta

- Score (valor de la función objetivo).
- Horas promedio por persona.
- Desviación estándar de horas (balance).
- Cobertura total peak (% del tiempo peak con ≥ 2 personas).
- Cantidad de turnos cortos (4h, 7h).
- Cantidad de fines de semana con dotación completa.

## Criterios de aceptación

- [ ] Al correr el optimizador con `num_propuestas = 3`, quedan 3 documentos en `proposals`.
- [ ] El admin puede publicar 1, 2 o las 3.
- [ ] El jefe solo ve las publicadas.
- [ ] Solo 1 propuesta puede estar `SELECCIONADA` por (branch, mes). Al seleccionar una, las otras pasan a `DESCARTADA`.
- [ ] Hay un comparador con métricas.
- [ ] Queda auditoría de cada cambio de estado.
