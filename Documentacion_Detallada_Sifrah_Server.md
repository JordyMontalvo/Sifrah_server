# Documentación Técnica Avanzada: Sifrah Server (The API Hub)

<div style="background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); padding: 60px 40px; border-radius: 20px; color: white; text-align: center; margin-bottom: 50px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <h1 style="font-size: 3.5em; margin: 0; letter-spacing: 2px;">SIFRAH SERVER</h1>
  <h2 style="font-size: 1.5em; font-weight: 300; margin-top: 10px; opacity: 0.9;">BACKEND CENTRAL Y ORQUESTADOR DE API</h2>
  <div style="width: 100px; height: 4px; background: #fbbf24; margin: 30px auto;"></div>
  <p style="font-size: 1.2em;">Arquitectura de Microservicios y Referencia de Endpoints</p>
  <p style="margin-top: 20px; font-size: 0.9em; opacity: 0.7;">Versión 1.0 | Marzo 2026</p>
</div>

## 1. Arquitectura del Backend

`Sifrah_server` es el componente central que procesa todas las solicitudes del ecosistema. Construido sobre **Next.js 9**, utiliza un enfoque híbrido de servidor de aplicaciones y funciones de API (`API Routes`), optimizado para despliegues escalables en entornos como Heroku.

### 1.1 Tecnologías Principales
*   **Framework**: Next.js v9.4.4.
*   **Servidor HTTP**: Node.js dinámico con `server.js` personalizado.
*   **ORM/Base de Datos**: Mongoose y MongoDB nativo.
*   **Seguridad**: Bcrypt (Hashing) y JWT (Tokens de Sesión).

---

## 2. Capa de Seguridad y Middleware

El servidor implementa un sistema de protección multinivel para garantizar la integridad de los datos de la red.

### 2.1 Middleware de CORS (`middleware-cors.js`)
Gestiona de forma estricta los orígenes permitidos (Admin: port 8081, App: port 8080) y configura los headers necesarios para peticiones `Preflight` y autenticación cruzada.

### 2.2 Validación de Sesión
Cada endpoint crítico verifica la validez del token JWT y los permisos del usuario (Administrador vs. Afiliado) antes de procesar la lógica de negocio.

---

## 3. Referencia de API: Módulo Administración (Admin)

Contiene 36 endpoints especializados. Entre los más críticos se encuentran:

*   **Gestión MLM**:
    *   `/api/admin/tree`: Manipulación y visualización de la genealogía.
    *   `/api/admin/periods`: Control de aperturas y cierres de comisiones.
*   **IA y Analítica**:
    *   `/api/admin/ai-leadership-predictions`: Consulta de modelos de liderazgo.
    *   `/api/admin/reports`: Generador masivo de reportes financieros y de red.
*   **Logística**:
    *   `/api/admin/delivery-management`: Orquestación de estados de envío a nivel nacional.
    *   `/api/admin/stock`: Control de inventario en tiempo real.

---

## 4. Referencia de API: Módulo Afiliado (App)

Contiene 35 endpoints para la movilidad del negocio.

*   **Comercio Electrónico**:
    *   `/api/app/mercadopay`: Integración con la pasarela de pagos para activaciones.
    *   `/api/app/activation`: Lógica de selección y validación de planes.
*   **Finanzas Personales**:
    *   `/api/app/transfer`: Transferencia inmediata de saldo E-Wallet.
    *   `/api/app/bonuses`: Visualización detallada de bonificaciones cargadas.
*   **Retención y Crecimiento**:
    *   `/api/app/tree-complete`: Carga optimizada de la red para visualización móvil.
    *   `/api/app/profile`: Gestión de datos sensibles y KYC.

---

## 5. Integraciones de Terceros

Sifrah Server actúa como un hub de servicios externos:
*   **Mercado Pago (Payments)**: Gestión de suscripciones y pagos únicos con confirmación vía webhooks.
*   **ImageKit (Media)**: Almacenamiento optimizado de vouchers de pago y fotos de perfil.
*   **Nodemailer (Mailing)**: Motor de emails transaccionales para recuperación de contraseñas y avisos de bonos.

---

## 6. Despliegue y Configuración

El sistema está configurado para despliegue continuo.

```bash
# Servidor de desarrollo
npm run dev

# Construcción de optimización
npm run build

# Inicio en producción (Heroku)
npm start
```

### 6.1 Variables de Entorno (.env)
Es imperativo configurar `DB_URL`, `JWT_SECRET`, `MERCADOPAGO_ACCESS_TOKEN` y `IMAGEKIT_PRIVATE_KEY` para el funcionamiento correcto de todos los módulos.

---

<footer style="margin-top: 100px; text-align: center; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 30px;">
  <p><b>SIFRAH SERVER - Arquitectura backend Robusta</b></p>
  <p>© 2026 Reservados todos los derechos. Documento propiedad de Sifrah corp.</p>
</footer>
