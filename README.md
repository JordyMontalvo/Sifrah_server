# 🚀 Servidor Sifrah - Plataforma MLM

Este es el backend de la plataforma MLM Sifrah, construido con [Next.js](https://nextjs.org/) y MongoDB.

## 📁 Estructura del Proyecto

```
server/
├── 📚 docs/                    # Documentación técnica
│   ├── DOCUMENTACION_SISTEMA_EMAIL.md
│   ├── RESUMEN_SISTEMA_EMAIL.md
│   └── README.md
├── 🔧 middleware/              # Middlewares del servidor
│   ├── middleware.js           # Middleware principal Next.js
│   └── middleware-cors.js      # CORS configurable
├── 🛠️ scripts/                # Scripts y utilidades
│   ├── test-email-config.js    # Prueba configuración email
│   └── server-mercadopago.js   # Servidor alternativo MP
├── 📧 templates/               # Templates HTML
│   └── welcome.html            # Template de bienvenida
├── ⚙️ config/                  # Configuraciones
│   ├── email.js                # Configuración de email
│   └── config-heroku.js        # Configuración Heroku
├── 🧩 components/              # Componentes del servidor
│   ├── db.js                   # Conexión MongoDB
│   ├── email-service.js        # Servicio de email
│   ├── mlm-prediction-service.js # Predicciones MLM
│   └── ...
└── 🌐 pages/api/               # Endpoints de la API
    ├── admin/                  # Endpoints de administración
    ├── app/                    # Endpoints de la aplicación
    ├── auth/                   # Endpoints de autenticación
    ├── email/                  # Endpoints de email
    └── ...
```

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

## 🌐 Endpoints Principales

### 🔐 Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/validate-email` - Validar email

### 📧 Sistema de Email
- `POST /api/email/welcome` - Email de bienvenida
- `POST /api/email/activation` - Email de activación
- `POST /api/email/password-reset` - Recuperación de contraseña
- `POST /api/email/contact` - Email de contacto
- `POST /api/email/commission` - Notificación de comisión

### 👥 Gestión de Usuarios
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/activations` - Gestionar activaciones
- `GET /api/admin/affiliations` - Gestionar afiliaciones

### 🤖 Predicciones de IA
- `GET /api/admin/ai-leadership-predictions` - Predicciones con IA
- `POST /api/admin/ai-leadership-predictions-update` - Actualizar predicciones

## 🔑 Variables de Entorno

```bash
# Servidor
NODE_ENV=production
PORT=3000

# Base de datos
DB_URL=mongodb://localhost:27017/sifrah

# Email (Gmail)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
ADMIN_EMAIL=admin@sifrah.com

# Frontend
FRONTEND_URL=

# IA/ML
PYTHON_API_URL=http://localhost:5001
```

## 🛠️ Scripts Disponibles

```bash
npm run dev      # Desarrollo
npm run build    # Build para producción
npm start        # Servidor de producción

# Scripts de utilidad
node scripts/change-email-sender.js  # Cambiar email de envío
node scripts/test-email-config.js    # Probar configuración de email
```

## 📧 Configurar Email de Envío

### Cambiar el email que envía los correos (recuperación, bienvenida, etc.)

**Opción 1: Script automático (Recomendado)**
```bash
node scripts/change-email-sender.js
```

**Opción 2: Manual**
1. Obtén un **App Password** de Gmail en: https://myaccount.google.com/apppasswords
2. Crea el archivo `.env` en `/server/` con:
   ```env
   EMAIL_USER=tu-nuevo-email@gmail.com
   EMAIL_PASS=tu-app-password-de-16-caracteres
   ADMIN_EMAIL=admin@sifrah.com
   FRONTEND_URL=http://localhost:8080
   ```
3. Prueba: `node scripts/test-email-config.js`

**Para producción (Heroku):**
```bash
heroku config:set EMAIL_USER="tu-email@gmail.com" --app tu-app
heroku config:set EMAIL_PASS="tu-app-password" --app tu-app
```

📖 **Guía detallada:** `CAMBIAR_EMAIL_RAPIDO.md` o `GUIA_CAMBIAR_EMAIL.md`

## 📦 Tecnologías

- **Next.js 9.4.4** - Framework React para backend
- **MongoDB 3.5.9** - Base de datos NoSQL
- **Nodemailer 7.0.5** - Envío de emails
- **Express 4.21.2** - Servidor HTTP
- **bcrypt 5.0.0** - Encriptación de contraseñas
- **Joi 17.13.3** - Validación de datos

## 🚀 Despliegue

### Heroku
```bash
git push heroku main
```

### Variables de entorno en Heroku
- Configurar todas las variables del archivo `env.example`
- Especial atención a `DB_URL`, `EMAIL_USER`, `EMAIL_PASS`

## 📞 Soporte

- **Documentación completa:** `docs/DOCUMENTACION_SISTEMA_EMAIL.md`
- **Scripts de prueba:** `scripts/`
- **Configuración:** `config/`

---

**Versión:** 1.0.0  
**Estado:** ✅ Producción  
**Mantenimiento:** Equipo de Desarrollo Sifrah 