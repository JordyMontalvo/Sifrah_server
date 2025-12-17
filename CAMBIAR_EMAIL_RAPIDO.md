# ⚡ GUÍA RÁPIDA: Cambiar Email de Envío

## 🎯 Para cambiar el email que envía los correos de recuperación:

### **OPCIÓN 1: Script Automático (Recomendado) 🤖**

```bash
cd /Users/jordymontalvo/Documents/sifrah/server
node scripts/change-email-sender.js
```

El script te pedirá:
1. **Email de envío** (tu nuevo Gmail)
2. **App Password** (contraseña de aplicación de Gmail)
3. **Email admin** (opcional)
4. **URL frontend** (opcional)

Y automáticamente:
- ✅ Crea/actualiza el archivo `.env`
- ✅ Valida los datos
- ✅ Opcionalmente prueba la configuración

---

### **OPCIÓN 2: Manual 📝**

1. **Obtén un App Password de Gmail:**
   - Ve a: https://myaccount.google.com/security
   - Activa **Verificación en 2 pasos**
   - Ve a **Contraseñas de aplicaciones**
   - Genera una nueva para "Correo"
   - Copia los 16 caracteres

2. **Crea el archivo `.env` en `/server/`:**

```bash
cd /Users/jordymontalvo/Documents/sifrah/server
nano .env
```

3. **Agrega esta configuración:**

```env
EMAIL_USER=tu-nuevo-email@gmail.com
EMAIL_PASS=tu-app-password-de-16-caracteres
ADMIN_EMAIL=admin@sifrah.com
FRONTEND_URL=http://localhost:8080
```

4. **Guarda y prueba:**

```bash
node scripts/test-email-config.js
```

---

### **PARA PRODUCCIÓN (Heroku):**

```bash
# Configurar variables
heroku config:set EMAIL_USER="tu-nuevo-email@gmail.com" --app tu-app
heroku config:set EMAIL_PASS="tu-app-password" --app tu-app

# Verificar
heroku config --app tu-app

# Ver logs
heroku logs --tail --app tu-app
```

O desde el dashboard:
- https://dashboard.heroku.com/
- Tu app → Settings → Config Vars
- Modifica `EMAIL_USER` y `EMAIL_PASS`

---

## ✅ Verificación

Después del cambio, todos estos emails se enviarán desde tu nuevo email:

- ✅ Bienvenida
- ✅ Activación
- ✅ **Recuperación de contraseña** ← El que querías cambiar
- ✅ Contacto
- ✅ Comisiones

---

## 📚 Más información

- **Guía completa:** `GUIA_CAMBIAR_EMAIL.md`
- **Template de configuración:** `ENV_TEMPLATE.txt`
- **Configuración actual:** `config/email.js`

---

## 🆘 Ayuda rápida

**¿Dónde está mi App Password?**
→ https://myaccount.google.com/apppasswords

**¿Cómo pruebo que funciona?**
→ `node scripts/test-email-config.js`

**¿Dónde veo los logs?**
→ `/server/logs/server.log`

**¿El email no llega?**
→ Revisa spam, verifica App Password, revisa logs

