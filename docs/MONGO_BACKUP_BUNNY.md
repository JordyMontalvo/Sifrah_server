# Backup automático MongoDB → Bunny.net Storage (Heroku)

Copia diaria de la base de datos `sifrah` a tu almacenamiento en Bunny.net usando **Heroku Scheduler** y el script `scripts/mongo-backup-bunny.js`.

## Requisitos

1. App Heroku: `sifrah-server-0920254d8662` (o la tuya).
2. **Heroku Scheduler** add-on (gratis).
3. Cuenta de Bunny.net Storage configurada con credenciales.

## 1. Variables en Heroku

Asegúrate de tener configuradas las siguientes variables de entorno en Heroku (pestaña *Settings* -> *Config Vars*):

```env
DB_URL="mongodb://usuario:pass@host:27017/sifrah?authSource=admin"
BUNNY_STORAGE_ZONE_NAME="tu-storage-zone-name"
BUNNY_STORAGE_PASSWORD="tu-storage-password"
BUNNY_STORAGE_HOSTNAME="br.storage.bunnycdn.com"  # o la correspondiente a tu región
BACKUP_RETENTION_DAYS=30                          # días de retención (opcional, default 30)
```

## 2. Configurar Heroku Scheduler (Ejecución Diaria a las 11 PM)

Heroku Scheduler no utiliza la sintaxis cron tradicional de Linux; se programa mediante su panel visual y corre en base a la hora **UTC** (hora universal).

### Configurar la hora local (11:00 PM / 23:00) a UTC:
Si tu zona horaria local es **GMT-5** (por ejemplo, Perú/Colombia/Ecuador):
- Las **11:00 PM** locales corresponden a las **04:00 AM UTC** del día siguiente.

### Pasos para programarlo:
1. Abre la consola en tu proyecto y ejecuta el comando para abrir el programador en tu navegador:
   ```bash
   heroku addons:open scheduler -a sifrah-server-0920254d8662
   ```
   *(O ve al dashboard de tu app en Heroku -> pestaña **Resources** -> haz clic en **Heroku Scheduler**).*
2. Haz clic en **Add Job**.
3. Configura los siguientes parámetros:
   - **Frecuencia (Interval):** `Daily`
   - **Hora de ejecución (Time):** `04:00` UTC *(equivalente a las 11:00 PM GMT-5)*.
   - **Tamaño del Dyno (Dyno Size):** `Basic` o `Standard` (según tu plan).
   - **Comando a ejecutar (Run Command):** `npm run backup:mongo`
4. Haz clic en **Save Job**.

¡Listo! A partir de ese momento, cada noche a las 11 PM local, Heroku ejecutará de forma automática el volcado y lo subirá a Bunny.net de manera segura.
