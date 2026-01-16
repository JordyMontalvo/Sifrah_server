# Variables de Entorno para CORS

## Configuración Recomendada

Para mayor seguridad, configura estas variables de entorno en Heroku:

### Variables de Entorno en Heroku

```bash
# Frontend principal
FRONTEND_URL=https://sifrah.vercel.app

# Panel de administración
ADMIN_URL=https://sifrah-admin.vercel.app

# Backend (opcional, si necesitas permitir peticiones del backend a sí mismo)
BACKEND_URL=https://sifrah-server-0920254d8662.herokuapp.com

# Orígenes adicionales (separados por coma)
CORS_ORIGINS=https://otro-dominio.com,https://otro-dominio-2.com
```

### Cómo Configurar en Heroku

#### Opción 1: Desde el Dashboard de Heroku

1. Ve a tu app en Heroku: https://dashboard.heroku.com/apps/sifrah-server-0920254d8662
2. Click en "Settings"
3. Click en "Reveal Config Vars"
4. Agrega las variables:
   - `FRONTEND_URL` = `https://sifrah.vercel.app`
   - `ADMIN_URL` = `https://sifrah-admin.vercel.app`

#### Opción 2: Desde la CLI de Heroku

```bash
heroku config:set FRONTEND_URL=https://sifrah.vercel.app -a sifrah-server-0920254d8662
heroku config:set ADMIN_URL=https://sifrah-admin.vercel.app -a sifrah-server-0920254d8662
```

### Verificar Variables Configuradas

```bash
heroku config -a sifrah-server-0920254d8662
```

## Cómo Funciona

El middleware de CORS ahora:

1. ✅ **Prioriza variables de entorno** - Usa `FRONTEND_URL`, `ADMIN_URL`, `BACKEND_URL`
2. ✅ **Permite orígenes adicionales** - Desde `CORS_ORIGINS` (separados por coma)
3. ✅ **Tiene fallback seguro** - Si no hay variables, usa URLs hardcoded solo en producción
4. ✅ **Desarrollo siempre funciona** - localhost:8080, 8081, 8082, 3000

## Ventajas de Usar Variables de Entorno

### 🔒 Seguridad
- No expones URLs en el código
- Fácil cambiar dominios sin tocar código
- Diferentes configuraciones por ambiente

### 🚀 Flexibilidad
- Cambios sin redeploy del código
- Soporte para múltiples dominios
- Fácil agregar/quitar orígenes

### 📝 Mantenibilidad
- Configuración centralizada
- Documentación clara
- Menos errores de hardcoding

## Ejemplo de Configuración Completa

```bash
# Producción
FRONTEND_URL=https://sifrah.vercel.app
ADMIN_URL=https://sifrah-admin.vercel.app

# Si tienes múltiples dominios adicionales
CORS_ORIGINS=https://sifrah-preview.vercel.app,https://sifrah-staging.vercel.app

# Node environment
NODE_ENV=production
```

## Troubleshooting

### Error: "No 'Access-Control-Allow-Origin' header"

**Causa:** El origen no está en la lista permitida

**Solución:**
1. Verifica que `FRONTEND_URL` esté configurado en Heroku
2. Verifica que la URL sea exacta (con/sin trailing slash)
3. Revisa los logs: `heroku logs --tail -a sifrah-server-0920254d8662`

### Error: "Origin null is not allowed"

**Causa:** La petición no tiene un header `Origin`

**Solución:**
- Esto es normal en desarrollo local
- En producción, asegúrate de que el frontend esté en HTTPS

## Notas Importantes

⚠️ **URLs deben ser exactas:**
- ✅ `https://sifrah.vercel.app` (correcto)
- ❌ `https://sifrah.vercel.app/` (con trailing slash - incorrecto)
- ❌ `http://sifrah.vercel.app` (http en vez de https - incorrecto)

⚠️ **Reiniciar después de cambios:**
- Heroku reinicia automáticamente al cambiar config vars
- Si no, reinicia manualmente: `heroku restart -a sifrah-server-0920254d8662`

⚠️ **Verificar en producción:**
- Usa las DevTools del navegador
- Pestaña Network → Headers
- Verifica que `Access-Control-Allow-Origin` esté presente
