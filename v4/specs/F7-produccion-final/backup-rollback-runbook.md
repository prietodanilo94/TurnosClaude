# F7 - Backup, restore y rollback

Este runbook debe probarse antes de declarar produccion final.

## Estado actual

- Servidor activo: `ssh pompeyo` (2.24.83.13)
- Repo servidor: `/opt/shift-optimizer`
- Stack: `/opt/shift-optimizer/v4`
- Contenedor frontend: `v4-frontend-1`
- Base SQLite dentro del contenedor: `/data/v4.db`
- Deploy: automatico via GitHub Actions al pushear a `main`
- Imagen: `ghcr.io/prietodanilo94/turnosclaude-v4:latest` + tag SHA
- Commit de rollback rapido: `v4-stable-20260505` (estado estable pre-sesion 2026-05-05)

## Backup manual antes de deploy

Objetivo: guardar una copia fechada de la base antes de cambios riesgosos.

```bash
ssh pompeyo
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
ssh pompeyo
cd /opt/shift-optimizer/v4
docker compose stop frontend
```

2. Verificar como esta montado `/data` antes de restore:

```bash
docker inspect v4-frontend-1 --format '{{json .Mounts}}'
```

3. Copiar backup al volumen/destino del contenedor.

Si `/data` es un bind mount en el host, copiar directo al path del host.
Si es un volume Docker, usar `docker cp`:

```bash
# Con contenedor detenido:
docker cp /opt/shift-optimizer/backups/v4/<archivo>.db v4-frontend-1:/data/v4.db
```

4. Levantar contenedor.

```bash
cd /opt/shift-optimizer/v4
docker compose up -d
docker logs --tail 80 v4-frontend-1
```

## Rollback de codigo por git (trigger Actions)

El metodo preferido para revertir un deploy reciente.

```bash
# Localmente:
git revert <commit-sha>
git push origin main
# GitHub Actions desplegara automaticamente (~4 min)
```

Monitorear en: https://github.com/prietodanilo94/TurnosClaude/actions

## Rollback rapido a imagen anterior (sin rebuild)

Util si el build fallo o el problema es de imagen, no de codigo.

```bash
ssh pompeyo
cd /opt/shift-optimizer/v4
# Ver imagenes disponibles con sus SHA
docker images ghcr.io/prietodanilo94/turnosclaude-v4

# Retag de imagen previa como latest
docker tag ghcr.io/prietodanilo94/turnosclaude-v4:<SHA-anterior> ghcr.io/prietodanilo94/turnosclaude-v4:latest
docker compose up -d
```

## Rollback al tag estable pre-sesion

```bash
ssh pompeyo
cd /opt/shift-optimizer
git checkout v4-stable-20260505
cd v4 && docker compose up -d --build
```

## Schema migration despues de merge

Si el branch incluye cambios al `schema.prisma` (ej. columna `tokenVersion`), ejecutar despues del deploy:

```bash
ssh pompeyo
docker exec v4-frontend-1 node ./node_modules/prisma/build/index.js db push
```

## Checklist antes de usar rollback

- [ ] Identificar problema exacto.
- [ ] Registrar hora y usuario afectado.
- [ ] Confirmar commit desplegado (ver GitHub Actions o `docker inspect`).
- [ ] Hacer backup del estado actual antes de revertir.
- [ ] Avisar a usuarios si hay ventana de indisponibilidad.
- [ ] Ejecutar rollback.
- [ ] Verificar login, supervisor y calendario.
- [ ] Registrar resultado en `implementation-log.md`.
