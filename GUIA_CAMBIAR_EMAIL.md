# 📧 GUÍA: Cambiar Email de Envío de Correos

## 🎯 Objetivo
Cambiar el email que envía los correos de recuperación de contraseña y otros emails del sistema.

---

## 📋 PASOS PARA DESARROLLO LOCAL

### **Paso 1: Crear archivo .env**

Crea un archivo llamado `.env` en el directorio `/server/`:

```bash
cd /Users/jordymontalvo/Documents/sifrah/server
touch .env
```

### **Paso 2: Copiar configuración**

Copia el contenido del archivo `ENV_TEMPLATE.txt` al archivo `.env` y actualiza con tus datos:

```env
# Email que enviará los correos
EMAIL_USER=tu-nuevo-email@gmail.com

# App Password de Gmail
EMAIL_PASS=tu-app-password-aqui

# Email del administrador
ADMIN_EMAIL=admin@sifrah.com

# URL del frontend
FRONTEND_URL=http://localhost:8080
```

### **Paso 3: Generar App Password de Gmail**

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. **Seguridad** → **Verificación en dos pasos** (actívala si no la tienes)
3. **Seguridad** → **Contraseñas de aplicaciones**
4. **Seleccionar aplicación** → **Correo**
5. **Seleccionar dispositivo** → **Otro** → Escribe "Sifrah"
6. **Generar** → Copia la contraseña de 16 caracteres
7. Pégala en `EMAIL_PASS` (sin espacios)

### **Paso 4: Probar la configuración**

Ejecuta el script de prueba:

```bash
cd /Users/jordymontalvo/Documents/sifrah/server
node scripts/test-email-config.js
```

Deberías ver:
```
✅ Configuración de email válida
✅ Conexión exitosa!
✅ Email de prueba enviado exitosamente!
```

---

## 🚀 PASOS PARA PRODUCCIÓN (Heroku)

### **Opción 1: Desde el Dashboard de Heroku**

1. Ve a tu aplicación en Heroku: https://dashboard.heroku.com/
2. Selecciona tu app (ejemplo: `sifrah-server`)
3. **Settings** → **Config Vars** → **Reveal Config Vars**
4. Modifica o agrega estas variables:

```
EMAIL_USER = tu-nuevo-email@gmail.com
EMAIL_PASS = tu-app-password-aqui
ADMIN_EMAIL = admin@sifrah.com
FRONTEND_URL = https://tu-frontend.vercel.app
```

5. Guarda los cambios
6. Heroku reiniciará automáticamente la aplicación

### **Opción 2: Desde la terminal con Heroku CLI**

```bash
# Configurar el nuevo email
heroku config:set EMAIL_USER="tu-nuevo-email@gmail.com" --app sifrah-server

# Configurar el app password
heroku config:set EMAIL_PASS="tu-app-password-aqui" --app sifrah-server

# Verificar configuración
heroku config --app sifrah-server

# Ver logs para confirmar
heroku logs --tail --app sifrah-server
```

---

## 🧪 PROBAR EL CAMBIO

### **Opción 1: Desde la aplicación**

1. Ve a tu aplicación web
2. Intenta recuperar tu contraseña
3. Verifica que el email llegue desde el nuevo remitente

### **Opción 2: Desde el endpoint de prueba**

```bash
# Para desarrollo local
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "tu-email-de-prueba@gmail.com"}'

# Para producción
curl -X POST https://tu-servidor-heroku.herokuapp.com/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "tu-email-de-prueba@gmail.com"}'
```

---

## 📝 EMAILS QUE USARÁN EL NUEVO REMITENTE

Una vez cambiado `EMAIL_USER`, **TODOS** los emails del sistema se enviarán desde este nuevo email:

✅ Email de bienvenida  
✅ Email de activación  
✅ **Email de recuperación de contraseña** ← Este es el que querías cambiar  
✅ Email de contacto  
✅ Email de comisiones  

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **Límites de Gmail**

Gmail tiene límites de envío:
- **500 emails por día** para cuentas normales
- **2000 emails por día** para Google Workspace

Si necesitas enviar más emails, considera usar:
- SendGrid
- Mailgun
- Amazon SES
- Postmark

### **Seguridad**

- ✅ **NUNCA** subas el archivo `.env` a Git
- ✅ El archivo `.env` ya está en `.gitignore`
- ✅ Usa **App Password** de Gmail, no tu contraseña normal
- ✅ Mantén las credenciales seguras

### **Verificación**

Después del cambio, verifica en los logs:

**Desarrollo:**
```bash
✅ Configuración de email válida
   Usuario: tu-nuevo-email@gmail.com
✅ Transporter configurado correctamente
```

**Producción (Heroku):**
```bash
heroku logs --tail --app sifrah-server | grep "email"
```

---

## 🔍 TROUBLESHOOTING

### **Error: "Invalid login: 534-5.7.9"**

**Problema:** Credenciales incorrectas  
**Solución:** Verifica que estés usando App Password, no la contraseña normal

### **Error: "Variables de entorno faltantes"**

**Problema:** No se configuró `EMAIL_USER` o `EMAIL_PASS`  
**Solución:** Agrega las variables en `.env` (local) o en Heroku (producción)

### **Error: "Transporter no configurado"**

**Problema:** El servicio de email no se inicializó  
**Solución:** Reinicia el servidor después de cambiar las variables

```bash
# Local
Ctrl+C y luego npm run dev

# Heroku
heroku restart --app sifrah-server
```

### **El email no llega**

1. Verifica que el email esté en spam
2. Revisa los logs para ver si se envió
3. Verifica que el App Password sea correcto
4. Intenta con otro email de destino

---

## 📞 SOPORTE ADICIONAL

Si tienes problemas, verifica:

1. **Configuración:** `/server/config/email.js`
2. **Servicio:** `/server/components/email-service.js`
3. **Endpoint:** `/server/pages/api/email/password-reset.js`
4. **Logs del servidor:** `heroku logs --tail`

---

**Última actualización:** Octubre 2025  
**Autor:** Equipo Sifrah  


