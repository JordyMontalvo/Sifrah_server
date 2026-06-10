# 🛠️ Scripts y Utilidades

Esta carpeta contiene scripts de utilidad, pruebas y configuraciones especiales.

## 📋 Archivos

- **test-email-config.js** - Script para probar la configuración del sistema de email
- **server-mercadopago.js** - Configuración alternativa del servidor con MercadoPago
- **change-email-sender.js** - Script interactivo para configurar el email del sistema
- **mongo-backup-drive.js** - Dump de MongoDB y subida a Google Drive (Heroku Scheduler)

## 🎯 Propósito

Centralizar herramientas de:
- Testing y debugging
- Configuraciones alternativas
- Scripts de mantenimiento
- Utilidades de desarrollo
- Migraciones de base de datos

## 🚀 Uso

```bash
# Probar configuración de email
node scripts/test-email-config.js

# Configurar email del sistema
node scripts/change-email-sender.js

# Backup MongoDB → Google Drive (requiere variables de entorno)
npm run backup:mongo
```

Ver `docs/MONGO_BACKUP_DRIVE.md` para configuración en Heroku.
 