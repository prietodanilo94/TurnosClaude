# Infraestructura y operaciones — TeamPlanner v4

## Servidores

| Alias SSH | IP | Rol | Path repo |
|-----------|-----|-----|-----------|
| `ssh pompeyo` | `2.24.83.13` | Producción empresa | `/opt/shift-optimizer` |
| `ssh antigravity` | `173.212.220.77` | Producción personal | `/opt/shift-optimizer` |

URL pública: `https://teamplanner.pompeyo.cl` (puerto 3014, nginx reverse proxy + Let's Encrypt)

---

## Docker

### Contenedor

```
Nombre:   v4-frontend-1
Imagen:   node:20-alpine (multi-stage)
Puerto:   3014:3014
Volumen:  v4_data → /data  (base de datos SQLite)
WorkDir:  /app             (código de la app)
```

### Comandos básicos

```bash
# Ver estado
ssh pompeyo "cd /opt/shift-optimizer/v4 && docker compose ps"

# Ver logs en tiempo real
ssh pompeyo "docker logs -f v4-frontend-1"

# Ver últimas 100 líneas de log
ssh pompeyo "docker logs --tail=100 v4-frontend-1"

# Reiniciar sin rebuild
ssh pompeyo "cd /opt/shift-optimizer/v4 && docker compose restart"

# Rebuild completo (tras cambios de código)
ssh pompeyo "cd /opt/shift-optimizer && git pull && cd v4 && docker compose up -d --build"
```

---

## Base de datos

### Ubicación

- **Volumen Docker**: `v4_data` (persiste entre rebuilds)
- **Dentro del contenedor**: `/data/v4.db` (SQLite)
- **`DATABASE_URL`** hardcodeada en Dockerfile: `file:/data/v4.db`

### Herramientas disponibles dentro del contenedor

- **`sqlite3`**: NO disponible (Alpine sin ese paquete)
- **Prisma CLI**: `node ./node_modules/prisma/build/index.js`
- **`@prisma/client`**: disponible en `/app/node_modules/@prisma/client`
- **Node.js**: v20.20.2

### Cómo ejecutar queries

El contenedor corre como usuario `nextjs` sin sqlite3. La única forma confiable es un script Node copiado al contenedor.

**Problema conocido**: el shell expande `$disconnect` a string vacío. Siempre usar archivos, no `-e`.

#### Patrón correcto

```bash
# 1. Crear script local
cat > /tmp/query.js << 'EOF'
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.calendar.count();
  console.log('Calendarios:', result);
}

main().finally(() => p['$disconnect']());
EOF

# 2. Copiar al contenedor y ejecutar
ssh pompeyo "docker cp /tmp/query.js v4-frontend-1:/tmp/query.js && docker exec v4-frontend-1 node /tmp/query.js"
```

#### Patrón desde Windows (PowerShell local → crear en pompeyo)

```powershell
# Crear el script en pompeyo directamente con heredoc ssh
ssh pompeyo @'
cat > /tmp/query.js << 'JSEOF'
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const n = await p.calendar.count();
  console.log('Total:', n);
}
main().finally(() => p['$disconnect']());
JSEOF
docker cp /tmp/query.js v4-frontend-1:/tmp/query.js
docker exec v4-frontend-1 node /tmp/query.js
'@
```

---

## Operaciones comunes

### Contar registros por tabla

```bash
# Plantilla: cambiar p.calendar por p.worker, p.branch, p.supervisor, p.auditLog, etc.
ssh pompeyo "cat > /tmp/count.js << 'EOF'
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const [calendars, branches, workers, supervisors, auditLogs, blocks, groups] = await Promise.all([
    p.calendar.count(),
    p.branch.count(),
    p.worker.count(),
    p.supervisor.count(),
    p.auditLog.count(),
    p.workerBlock.count(),
    p.branchGroup.count(),
  ]);
  console.log({ calendars, branches, workers, supervisors, auditLogs, blocks, groups });
}
main().finally(() => p['\$disconnect']());
EOF
docker cp /tmp/count.js v4-frontend-1:/tmp/count.js && docker exec v4-frontend-1 node /tmp/count.js"
```

### Borrar todos los calendarios

```bash
ssh pompeyo "cat > /tmp/del-cals.js << 'EOF'
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const { count } = await p.calendar.deleteMany({});
  console.log('Eliminados:', count, 'calendarios');
}
main().finally(() => p['\$disconnect']());
EOF
docker cp /tmp/del-cals.js v4-frontend-1:/tmp/del-cals.js && docker exec v4-frontend-1 node /tmp/del-cals.js"
```

### Borrar historial (AuditLog)

```bash
ssh pompeyo "cat > /tmp/del-audit.js << 'EOF'
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const { count } = await p.auditLog.deleteMany({});
  console.log('Eliminados:', count, 'registros de auditoría');
}
main().finally(() => p['\$disconnect']());
EOF
docker cp /tmp/del-audit.js v4-frontend-1:/tmp/del-audit.js && docker exec v4-frontend-1 node /tmp/del-audit.js"
```

### Backup de la base de datos

```bash
# Copiar SQLite del contenedor al host
ssh pompeyo "docker cp v4-frontend-1:/data/v4.db /tmp/v4-backup-$(date +%Y%m%d).db"

# Descargar al local (desde Windows)
scp pompeyo:/tmp/v4-backup-*.db .
```

### Restaurar backup

```bash
# Subir al host y copiar al contenedor
scp v4-backup-YYYYMMDD.db pompeyo:/tmp/restore.db
ssh pompeyo "docker cp /tmp/restore.db v4-frontend-1:/data/v4.db"
ssh pompeyo "cd /opt/shift-optimizer/v4 && docker compose restart"
```

### Aplicar cambios de schema (después de editar schema.prisma)

```bash
ssh pompeyo "docker exec v4-frontend-1 node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate"
```

---

## Schema — tablas principales

| Tabla | Descripción | Clave única |
|-------|-------------|-------------|
| `Branch` | Sucursales | `codigo` |
| `BranchGroup` | Grupos de sucursales | `id` |
| `BranchTeam` | Equipo por área de negocio | `(branchId, areaNegocio)` |
| `Worker` | Vendedores | `rut` |
| `WorkerBlock` | Bloqueos por rango de fechas | `id` |
| `Calendar` | Calendarios guardados | `(branchTeamId, year, month)` |
| `Supervisor` | Supervisores | `email` |
| `SupervisorBranch` | Relación supervisor ↔ sucursal | `(supervisorId, branchId)` |
| `User` | Usuarios admin | `email` |
| `AuditLog` | Historial de acciones | `id` |

Relaciones clave:
- `Branch → BranchTeam → Worker + Calendar`
- `Branch → BranchGroup` (muchos a uno, nullable)
- `Supervisor → SupervisorBranch ← Branch`

---

## Variables de entorno relevantes

Archivo `.env` en `/opt/shift-optimizer/v4/.env` (nunca en git).

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | `file:/data/v4.db` (definida en Dockerfile, no en .env) |
| `JWT_SECRET` | Secret para cookies de sesión |
| `N8N_WEBHOOK_URL` | URL del webhook N8N para notificaciones |
| `ADMIN_EMAIL` | Email del admin inicial |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt (escapar `$` como `$$` en Docker Compose) |

---

## N8N

| Instancia | URL | Host | Path |
|-----------|-----|------|------|
| n7n (empresa) | `https://n7n.pompeyo.cl` | `ssh pompeyo` | `/opt/n8n` |
| n9n (personal) | `https://n9n.dpmake.cl` | `ssh antigravity` | `/opt/n8n` |

```bash
# Ver logs n8n en pompeyo
ssh pompeyo "cd /opt/n8n && docker compose logs -f"

# Reiniciar n8n
ssh pompeyo "cd /opt/n8n && docker compose restart"
```

---

## Nginx (pompeyo)

Configuraciones en `/etc/nginx/sites-available/`:
- `teamplanner.pompeyo.cl` → proxy `localhost:3014`
- `n7n.pompeyo.cl` → proxy `localhost:5678`

Certificado Let's Encrypt válido hasta 2026-08-11, renovación automática vía `certbot renew`.

```bash
# Verificar renovación automática
ssh pompeyo "sudo certbot renew --dry-run"

# Recargar nginx
ssh pompeyo "sudo nginx -s reload"
```
