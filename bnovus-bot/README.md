# bnovus-bot

Bot de automatización de reportes de asistencia Bnovus. Corre con Playwright (Node.js) en modo headless en el servidor, o headed localmente para pruebas.

## Qué hace

Ejecuta 5 pasos en secuencia:

1. **Login** — Inicia sesión en Bnovus con las credenciales del `.env`
2. **Sync ausentismos** — Navega a "Actualizar Ausentismos" y sincroniza el mes completo
3. **Recalcular asistencia** — Recalcula el mes actual; espera polling hasta que termine (máx 15 min)
4. **Reporte diario** — Descarga el reporte del día actual en Excel (modo Rango, fecha de hoy)
5. **Deliver** — Envía el Excel al webhook de n8n vía POST multipart; elimina el archivo local si fue exitoso

## Estructura

```
bnovus-bot/
├── src/
│   ├── test.js       ← script principal (pipeline completo)
│   ├── deliver.js    ← envío del Excel a n8n
│   └── utils.js      ← helpers compartidos
├── screenshots/      ← capturas por ejecución (no commiteadas)
├── downloads/        ← Excel descargado temporalmente (se elimina al entregar)
├── session/          ← estado de sesión del browser (no commiteado)
├── Dockerfile
├── docker-compose.yml
├── .env              ← credenciales (no commiteado)
└── .env.example      ← plantilla
```

## Variables de entorno (.env)

```env
BNOVUS_URL=https://login.bnovus.cl/
BNOVUS_USER=usuario@empresa.cl
BNOVUS_PASS=contraseña
N8N_WEBHOOK_URL=https://n9n.dpmake.cl/webhook/cesaria
HEADLESS=true        # false para ver el browser (solo en local)
```

## Correr localmente (headed, para pruebas)

```bash
# En la carpeta bnovus-bot
HEADLESS=false  # en .env
node src/test.js
```

## Servidor (ssh pompeyo)

El bot vive en `/opt/shift-optimizer/bnovus-bot/`.

### Correr manualmente

```bash
ssh pompeyo
cd /opt/shift-optimizer/bnovus-bot
docker compose run --rm bot
```

### Ver logs

```bash
ssh pompeyo "tail -100 /var/log/bnovus-bot.log"
# o en tiempo real:
ssh pompeyo "tail -f /var/log/bnovus-bot.log"
```

### Horario automático (cron)

Corre lunes a viernes. Horarios en hora Chile (UTC-4):

| Hora Chile | Hora UTC (cron) |
|------------|-----------------|
| 09:40      | 13:40           |
| 10:40      | 14:40           |
| 11:40      | 15:40           |
| 12:30      | 16:30           |
| 17:40      | 21:40           |

Ver/editar el cron: `ssh pompeyo "crontab -l"`

### Actualizar el bot tras cambios en el código

```bash
ssh pompeyo
cd /opt/shift-optimizer
git pull
cd bnovus-bot
docker compose build
```

## n8n

El bot **no es activado por n8n** — es el cron del servidor quien lo activa.  
n8n solo **recibe** el archivo Excel al final del pipeline vía webhook.

En el workflow de n8n, el nodo "Extract from File" debe tener:
- **Input Binary Field**: `data0`

## Si algo falla

- El Excel se conserva en `downloads/` si el deliver falló (para reintento manual)
- Los screenshots de cada paso están en `screenshots/` para diagnóstico
- Logs completos en `/var/log/bnovus-bot.log` en el servidor
