# Monitoreo con Trialogic

El servidor reporta a Trialogic (https://trialogic-ia.vercel.app) cuando una petición responde **5xx** o tarda
demasiado, y cuando un error tumba el proceso. Está **apagado por defecto**: sin `TRIALOGIC_INGEST_URL` no hace nada.

## Activarlo
1. En Trialogic → **Monitoreo** → *Conectar un servidor* → proyecto **Sifrah_server** → copia el enlace (se muestra una vez).
2. Guárdalo en el `.env` del servidor y reinicia:
   ```
   TRIALOGIC_INGEST_URL=https://trialogic-ia.vercel.app/api/ingest/<token>
   ```
3. Los errores aparecen en Trialogic → **Incidencias**, agrupados.

## Qué envía (y qué no)
Envía: mensaje de error, traza, método, ruta **sin parámetros** (los ids se normalizan), estado HTTP y versión.
**Nunca** envía cuerpos de petición, cabeceras, cookies ni parámetros de la URL. Trialogic además limpia contraseñas,
tokens y datos personales antes de guardar.

## Garantías
- No lanza errores ni bloquea: todo va en `try/catch` y con tiempo límite de 2 s.
- No cambia las respuestas ni el ciclo de vida del proceso (`uncaughtExceptionMonitor` solo observa).
- Sin dependencias. Compatible con Node 12 o superior (probado en 16, 18, 20 y 22).

## Apagarlo
Quita `TRIALOGIC_INGEST_URL` y reinicia.
