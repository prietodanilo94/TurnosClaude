# F7 - Release readiness

Este documento se completa antes de declarar produccion final.

## Decision

- Fecha:
- Responsable:
- Version/commit candidato:
- Ambiente:
- Decision:
  - [ ] Mantener piloto controlado.
  - [ ] Produccion parcial.
  - [ ] Produccion final.

## Resumen ejecutivo

Completar en lenguaje simple:

- Que queda habilitado:
- Que queda pendiente:
- Riesgo principal:
- Plan si algo falla:

## Evidencia tecnica

- [ ] `npm.cmd test` OK.
- [ ] `npm.cmd run build` OK.
- [ ] Deploy en servidor OK.
- [ ] `docker compose ps` muestra `v4-frontend-1` arriba.
- [ ] `https://turnos4.dpmake.cl/login` responde 200.
- [ ] Logs recientes sin errores criticos.
- [ ] Commit desplegado registrado.

## Evidencia funcional

- [ ] Matriz `functional-test-matrix.md` ejecutada.
- [ ] Al menos un flujo admin completo OK.
- [ ] Al menos un flujo supervisor sucursal unica OK.
- [ ] Al menos un flujo supervisor grupo OK.
- [ ] Historial `Ver calendario` OK en caso admin y supervisor.
- [ ] Guardado incompleto probado.
- [ ] Exportacion probada o pendiente no bloqueante aprobado.

## Datos

- [ ] `data-readiness.md` completado.
- [ ] Sin bloqueantes en supervisores piloto.
- [ ] Sin bloqueantes en sucursales/equipos piloto.
- [ ] Sin bloqueantes en calendarios piloto.

## Backup y rollback

- [ ] Backup reciente creado.
- [ ] Ubicacion del backup registrada.
- [ ] Restore probado o bloqueo aceptado explicitamente.
- [ ] Rollback por git documentado.
- [ ] Responsable de rollback definido.

## Pendientes

| Pendiente | Tipo | Bloquea go-live | Responsable | Fecha objetivo |
|-----------|------|-----------------|-------------|----------------|
| | Bloqueante / Importante / Post go-live | Si / No | | |

## Aprobacion

- [ ] Producto/operacion acepta abrir.
- [ ] Soporte definido para primera semana.
- [ ] Usuarios informados de como reportar problemas.
- [ ] Decision registrada en este documento.
