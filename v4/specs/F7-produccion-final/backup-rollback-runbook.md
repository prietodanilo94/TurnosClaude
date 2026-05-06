# F7 - Backup, restore y rollback

Este runbook debe probarse antes de declarar produccion final.

## Estado actual conocido

- Dominio: `turnos4.dpmake.cl`
- Servidor: `antigravity`
- Repo servidor: `/opt/shift-optimizer`
- Stack: `/opt/shift-optimizer/v4`
- Contenedor frontend: `v4-frontend-1`
- Base SQLite dentro del contenedor: `/data/v4.db`

## Backup manual antes de deploy

Objetivo: guardar una copia fechada de la base antes de cambios riesgosos.

```bash
mkdir -p /opt/shift-optimizer/backups/v4
docker cp v4-frontend-1:/data/v4.db /opt/shift-optimizer/backups/v4/v4-$(date +%Y%m%d-%H%M%S).db
ls -lh /opt/shift-optimizer/backups/v4 | tail
```

## Verificar backup

```bash
ls -lh /opt/shift-optimizer/backups/v4
```

Opcional si hay `sqlite3` disponible en host:

```bash
sqlite3 /opt/shift-optimizer/backups/v4/<archivo>.db ".tables"
```

## Restore manual

Usar solo con decision explicita, porque reemplaza datos actuales.

1. Detener contenedor.

```bash
cd /opt/shift-optimizer/v4
docker compose stop frontend
```

2. Copiar backup al volumen/destino del contenedor.

La forma exacta depende de como este montado `/data`. Antes de ejecutar restore real, confirmar con:

```bash
docker inspect v4-frontend-1 --format '{{json .Mounts}}'
```

3. Levantar contenedor.

```bash
cd /opt/shift-optimizer/v4
docker compose up -d
docker logs --tail 80 v4-frontend-1
```

## Rollback de codigo por git

Usar si el problema viene de un commit reciente.

```bash
cd /opt/shift-optimizer
git log --oneline -5
git revert <commit>
git push origin main
cd /opt/shift-optimizer/v4
docker compose up -d --build
```

Si el revert se hace local primero, seguir flujo normal:

```bash
git push origin main
ssh antigravity "cd /opt/shift-optimizer && git pull --ff-only origin main && cd v4 && docker compose up -d --build"
```

## Rollback rapido a imagen anterior

Pendiente de definir. Docker Compose reconstruye imagen localmente y no conserva una estrategia formal de versionado. Para produccion final, definir una de estas opciones:

- Taggear imagen por commit.
- Mantener ultimo tar de imagen estable.
- Preferir rollback por git + rebuild.

## Checklist antes de usar rollback

- [ ] Identificar problema exacto.
- [ ] Registrar hora y usuario afectado.
- [ ] Confirmar commit desplegado.
- [ ] Hacer backup del estado actual antes de revertir.
- [ ] Avisar a usuarios si hay ventana de indisponibilidad.
- [ ] Ejecutar rollback.
- [ ] Verificar login, supervisor y calendario.
- [ ] Registrar resultado en `implementation-log.md`.
