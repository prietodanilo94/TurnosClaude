# F7 - Observabilidad basica

Comandos de diagnostico rapido para la primera semana de produccion.

## Estado del contenedor

```bash
ssh pompeyo
docker compose -f /opt/shift-optimizer/v4/docker-compose.yml ps
```

Esperado: `v4-frontend-1` en estado `Up`.

## Logs del contenedor

```bash
# Ultimas 100 lineas
docker logs --tail 100 v4-frontend-1

# Seguir en vivo
docker logs -f v4-frontend-1

# Filtrar errores
docker logs v4-frontend-1 2>&1 | grep -i "error\|exception\|fatal"
```

La linea de arranque exitosa es:
```
✓ Ready in Xms
```

## Confirmar commit desplegado

```bash
# Ver imagen corriendo
docker inspect v4-frontend-1 --format '{{.Config.Image}}'

# Ver etiqueta/SHA de la imagen
docker images ghcr.io/prietodanilo94/turnosclaude-v4 --format "{{.Tag}}\t{{.CreatedAt}}"
```

El SHA del commit desplegado aparece como tag junto al `latest`.

Alternativamente, desde GitHub Actions:
https://github.com/prietodanilo94/TurnosClaude/actions

## Confirmar que la app responde

```bash
curl -s -o /dev/null -w "%{http_code}" https://turnos4.dpmake.cl/login
# Esperado: 200
```

## Revisar historial en la app

El historial cubre las siguientes acciones criticas:

| Accion | Registrada |
|--------|------------|
| Generar calendario | calendar.generate |
| Guardar calendario | calendar.save |
| Exportar calendario | calendar.export |
| Intento guardar bloqueado | calendar.validation_blocked |
| Sincronizar dotacion | dotacion.sync |
| Bloquear/desbloquear vendedor | worker.block / worker.unblock |
| Crear supervisor | supervisor.create |
| Crear sucursal | branch.create |

Para revisar: `/admin/historial` — filtrar por accion, fecha o sucursal.
Cada entrada tiene link "Ver calendario →" que lleva directo al calendario afectado.

## Alertas manuales durante primera semana

Revisar diariamente:

1. `docker logs --tail 50 v4-frontend-1` — errores de arranque o DB
2. `/admin/historial` — actividad anormal (muchas generaciones, sync masivo)
3. `/admin/datos` — nuevos equipos sin categoria o supervisores sin credenciales

Si aparece un error repetido en logs:
- Anotar el mensaje exacto y hora
- Abrir `/admin/historial` y buscar la accion cercana a ese horario
- Registrar en `implementation-log.md`

## Diagnostico rapido de 3 pasos

```bash
# 1. Contenedor corriendo
docker compose -f /opt/shift-optimizer/v4/docker-compose.yml ps

# 2. App responde
curl -s -o /dev/null -w "%{http_code}\n" https://turnos4.dpmake.cl/login

# 3. Sin errores recientes
docker logs --tail 30 v4-frontend-1 2>&1 | grep -c "error" || echo "0 errores"
```

Si el paso 1 falla: `docker compose up -d` o rollback.
Si el paso 2 falla: revisar logs del paso 3.
Si el paso 3 muestra errores: revisar contexto del log y abrir incidente.
