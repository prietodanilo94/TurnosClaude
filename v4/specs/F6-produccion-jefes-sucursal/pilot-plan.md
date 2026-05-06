# F6 - Plan de piloto controlado

Este documento se completa antes de invitar a jefes de sucursal al piloto.

## Lista piloto

| Nombre | Email | Sucursal/grupo | Credenciales OK | Prueba completa | Feedback recibido |
|--------|-------|----------------|-----------------|-----------------|-------------------|
| | | | No | No | No |
| | | | No | No | No |
| | | | No | No | No |

## Responsable de soporte

- Responsable primera respuesta:
- Horario de soporte:
- Canal:

## Que debe reportar el usuario

Pedir siempre:

- Usuario o correo.
- Sucursal o grupo.
- Mes.
- Accion que intento.
- Captura de pantalla.
- Si apreto Guardar, Generar, Regenerar o Exportar.

## Prueba completa por jefe piloto

- [ ] Login.
- [ ] Ve solo sus sucursales o grupos.
- [ ] Abre calendario.
- [ ] Cambia vendedor.
- [ ] Edita turno.
- [ ] Revisa cobertura/Gantt.
- [ ] Guarda.
- [ ] Exporta o confirma que exportacion queda controlada.
- [ ] Revisa historial con admin si hubo cambio relevante.

## Rollback si calendario queda inconsistente

1. No regenerar varias veces intentando arreglar a ciegas.
2. Anotar usuario, sucursal/grupo, mes y hora aproximada.
3. Revisar historial admin para identificar el ultimo `calendar.generate` o `calendar.assign`.
4. Si el problema es solo asignacion, corregir manualmente desde calendario y guardar.
5. Si el problema es estructura de turnos, usar `Regenerar` con confirmacion y volver a asignar.
6. Si el problema afecta muchos datos o varias sucursales, detener piloto y restaurar desde backup segun runbook F7.

## Criterio de salida del piloto

El piloto F6 se considera completado cuando:

- 2 o 3 jefes completan el flujo mensual.
- No quedan bugs bloqueantes.
- Las fricciones de lenguaje quedan registradas.
- Existe responsable de soporte para la primera semana.
- Se decide si continuar a F7 o abrir produccion parcial.
