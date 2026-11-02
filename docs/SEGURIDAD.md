# Revisión de seguridad (2026-11)

Producción del backend corre en **DigitalOcean** (no en Heroku). Quedan restos de Heroku en el repo (`Procfile`, `.qgtunnel`, script `heroku-postbuild`, guías con comandos `heroku`); no se han tocado.

## Hallazgos y estado

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Crítica | `/api/notifications/send` sin autenticación y con `Access-Control-Allow-Origin: *`; 500 devolvía `error.message` | Corregido: `applyCORS` + `requireAdmin`, 500 genérico |
| 2 | Alta | `/api/notifications/register` sin sesión permitía cambiar el `fcmToken` de cualquier socio y devolvía `result` | Parcial: con sesión se usa el usuario de la sesión; sin sesión sigue el camino antiguo (temporal) |
| 3 | Media | `.qgtunnel` versiona el host de Mongo en EC2 (`:27017`, `encrypted = false`) | Pendiente: revisar Security Group de EC2, autenticación de Mongo y TLS |
| 4 | Media | El frontend escribía sesión y token FCM en consola | Corregido en `Sifrah_app` |
| 5 | Baja | `auth/validate-email` permite enumerar emails | Pendiente (puede ser necesario para recuperar contraseña) |
| 6 | Baja | `DebugPanel.vue` visible en producción | Pendiente |

## Contrato de `/api/notifications/*`

- `POST /api/notifications/send`: exige sesión de admin (`Authorization: Bearer <session>`). Sin sesión 401; no admin 403. Quien lo llame (p. ej. el panel `sifrah-admin`) debe enviar la sesión.
- `POST /api/notifications/register`:
  - Con `Authorization: Bearer <session>`: actualiza al usuario de la sesión; ignora `dni`/`userId`. Sesión inválida → 401.
  - Sin sesión (temporal): acepta `{ dni | userId, fcmToken }` y registra `console.warn('[notifications/register] legacy sin sesión')`.
  - Respuesta: `{ success, message }`, sin `result`.
- CORS: solo orígenes de `middleware/middleware-cors.js`.

## Fases

1. Desplegar `Sifrah_server` (este cambio) en DigitalOcean y verificar con curl y Runtime Logs.
2. Desplegar `Sifrah_app` (web en Vercel y nueva build nativa).
3. Más adelante: `register` exige sesión cuando el `warn` esté cerca de 0 durante varias semanas.

## Fuera de alcance

No se tocaron cierres, rangos ni comisiones.
