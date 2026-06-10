# Backup automático MongoDB → Google Drive (Heroku)

Copia diaria de la base `sifrah` a una carpeta de Google Drive usando **Heroku Scheduler** y el script `scripts/mongo-backup-drive.js`.

## Requisitos

1. App Heroku: `sifrah-server-0920254d8662` (o la tuya).
2. **Heroku Scheduler** add-on (gratis).
3. Cuenta de servicio de Google Cloud con acceso a Drive.
4. `MONGODB_URI` en Heroku apuntando a tu MongoDB (EC2).

## 1. Google Drive — cuenta de servicio

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (o usa uno existente).
3. **APIs y servicios → Biblioteca** → activa **Google Drive API**.
4. **IAM → Cuentas de servicio → Crear** → descarga el JSON de claves.
5. En Google Drive, crea una carpeta (ej. `Sifrah Backups`).
6. Comparte esa carpeta con el email de la cuenta de servicio (`...@....iam.gserviceaccount.com`) como **Editor**.
7. Copia el **ID de la carpeta** desde la URL:  
   `https://drive.google.com/drive/folders/ESTE_ES_EL_ID`

## 2. Buildpack apt (mongodump en Heroku)

Heroku no trae `mongodump` por defecto. El repo incluye `Aptfile` con el `.deb` oficial de MongoDB para **Ubuntu 24.04** (stack Heroku-24). No uses el nombre de paquete `mongodb-database-tools` a secas: en Noble no está en los repos estándar y el deploy falla con `Unable to locate package`.

```bash
cd server
heroku buildpacks:add --index 1 heroku-community/apt -a sifrah-server-0920254d8662
git add Aptfile .buildpacks
git commit -m "añadir mongodump para backups"
git push heroku master
```

Orden de buildpacks (debe quedar así):

1. `heroku-community/apt`
2. `heroku/go` (si aplica)
3. `heroku/nodejs`

## 3. Variables en Heroku

```bash
# URI de MongoDB (la de EC2 o la que use producción)
heroku config:set MONGODB_URI="mongodb://usuario:pass@host:27017/sifrah?authSource=admin" -a sifrah-server-0920254d8662

# JSON de la cuenta de servicio en UNA línea (escapa comillas en PowerShell o usa dashboard)
heroku config:set GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account",...}' -a sifrah-server-0920254d8662

# ID de la carpeta de Drive
heroku config:set GOOGLE_DRIVE_FOLDER_ID="tu-folder-id" -a sifrah-server-0920254d8662

# Opcional: días de retención (default 30)
heroku config:set BACKUP_RETENTION_DAYS=30 -a sifrah-server-0920254d8662
```

En el dashboard de Heroku, pega el JSON completo en `GOOGLE_DRIVE_CREDENTIALS_JSON` (más fácil que por CLI).

## 4. Heroku Scheduler

1. En la app Heroku: **Resources → Add-ons → Heroku Scheduler**.
2. Crea un job:
   - **Frecuencia:** Daily (ej. 04:00 UTC)
   - **Comando:** `npm run backup:mongo`
   - **Dyno size:** igual que tu app (Basic/Standard)

## 5. Probar manualmente

```bash
heroku run npm run backup:mongo -a sifrah-server-0920254d8662
```

Deberías ver en los logs algo como:

```
[backup] Ejecutando mongodump...
[backup] Dump creado: 12.34 MB
[backup] Subiendo sifrah-mongo-backup-2026-06-04-040000.gz a Google Drive...
[backup] Completado.
```

Y el archivo en la carpeta de Drive.

## 6. Restaurar un backup

Descarga el `.gz` de Drive y en una máquina con `mongorestore`:

```bash
mongorestore --uri="mongodb://..." --archive=backup.gz --gzip --drop
```

`--drop` borra colecciones antes de restaurar; quítalo si solo quieres importar sin reemplazar.

## Solución de problemas en deploy

| Error en build | Solución |
|----------------|----------|
| `E: Unable to locate package mongodb-database-tools` | El `Aptfile` debe usar la URL del `.deb` (ver `Aptfile` en el repo), no solo el nombre del paquete |
| Buildpack `apt` al final del log pero deploy falla antes | Redeploy tras actualizar `Aptfile` |

Orden de buildpacks recomendado: `heroku-community/apt` primero, luego `nodejs` (y `go` si aplica). Si `apt` va segundo también puede funcionar una vez corregido el `Aptfile`.

## Notas

- El dump se genera en `/tmp` del dyno y se borra al terminar; no ocupa espacio persistente.
- Si MongoDB está en EC2, el dyno de Heroku debe poder conectarse al puerto **27017** (security group de AWS abierto a IPs de Heroku o `0.0.0.0/0` solo para ese puerto con auth fuerte).
- **No subas el JSON de la cuenta de servicio al repositorio.** Solo en variables de Heroku.
- Rota credenciales si alguna vez se expusieron en chat o commits.
