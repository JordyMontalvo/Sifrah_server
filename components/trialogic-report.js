'use strict'
// Trialogic · reportero de errores de producción (sin dependencias; Node 12 o superior).
//
// - INERTE si TRIALOGIC_INGEST_URL no está definida: no hace nada y no cambia el comportamiento.
// - Nunca lanza errores ni bloquea: todo va en try/catch y con tiempo límite.
// - Envía solo: título del error, traza, método, ruta SIN parámetros, estado HTTP y nivel.
//   NUNCA cuerpos de petición, cabeceras, cookies ni parámetros de la URL.
//   (Trialogic además limpia contraseñas, tokens y datos personales al recibirlo.)

const http = require('http')
const https = require('https')
const { URL } = require('url')

const ingestUrl = () => process.env.TRIALOGIC_INGEST_URL || ''
const timeoutMs = () => Number(process.env.TRIALOGIC_TIMEOUT_MS) || 2000
const slowMsDefault = () => Number(process.env.TRIALOGIC_SLOW_MS) || 20000

// Límite de envío para no inundar la red si algo falla en bucle.
const recent = new Map()
let windowStart = 0
let windowCount = 0

function allow(title) {
  const now = Date.now()
  if (now - windowStart > 60000) { windowStart = now; windowCount = 0 }
  if (windowCount >= 60) return false
  const last = recent.get(title)
  if (last && now - last < 10000) return false
  recent.set(title, now)
  if (recent.size > 200) recent.clear()
  windowCount += 1
  return true
}

/** Ruta sin parámetros y con los identificadores normalizados (agrupa lo mismo). */
function cleanPath(url) {
  return String(url || '')
    .split('?')[0]
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
}

function post(payload) {
  return new Promise((resolve) => {
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    try {
      const raw = ingestUrl()
      if (!raw) return done()
      const u = new URL(raw)
      const body = JSON.stringify(payload)
      const lib = u.protocol === 'http:' ? http : https
      const req = lib.request(
        {
          method: 'POST',
          hostname: u.hostname,
          port: u.port || undefined,
          path: u.pathname + u.search,
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
          timeout: timeoutMs(),
        },
        (res) => { res.resume(); res.on('end', done); res.on('error', done) }
      )
      req.on('timeout', () => { req.destroy(); done() })
      req.on('error', done)
      req.end(body)
      const guard = setTimeout(done, timeoutMs() + 500)
      if (guard.unref) guard.unref()
    } catch (e) {
      done()
    }
  })
}

/**
 * Reporta un error. Devuelve una promesa que NUNCA falla (útil para esperarla en serverless).
 * extra admite: method, url, status, level ('warning' | 'error' | 'fatal'), release.
 */
function report(errorOrMessage, extra) {
  try {
    if (!ingestUrl()) return Promise.resolve()
    const e = extra || {}
    const isErr = errorOrMessage && typeof errorOrMessage === 'object'
    const title = String(isErr ? errorOrMessage.message || errorOrMessage.name || 'Error' : errorOrMessage).slice(0, 300)
    if (!allow(title)) return Promise.resolve()
    return post({
      title,
      stack: isErr && errorOrMessage.stack ? String(errorOrMessage.stack).slice(0, 8000) : undefined,
      level: e.level || 'error',
      method: e.method,
      url: e.url ? cleanPath(e.url) : undefined,
      status: e.status,
      release: e.release || process.env.TRIALOGIC_RELEASE || process.env.HEROKU_SLUG_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA,
    })
  } catch (e) {
    return Promise.resolve()
  }
}

/**
 * Vigila una petición: reporta si responde 5xx o si tarda demasiado (antes de que el proveedor la corte).
 * Llamar UNA vez al inicio de cada petición. Opciones:
 *   slowMs      tiempo para avisar de petición lenta (por defecto 20 s; en Vercel Hobby usa 8000)
 *   serverless  true en funciones serverless: espera a enviar el reporte de un 5xx antes de cerrar
 *               la respuesta, porque la función se congela al terminar.
 */
function monitorRequest(req, res, opts) {
  try {
    if (!ingestUrl() || !req || !res || typeof res.on !== 'function') return
    if (res.trialogicMonitored) return // ya vigilada (p. ej. si una ruta llama dos veces)
    res.trialogicMonitored = true
    const o = opts || {}
    const method = req.method
    const path = cleanPath(req.originalUrl || req.url)
    const slowMs = Number(o.slowMs) || slowMsDefault()
    let finished = false

    const slow = setTimeout(() => {
      if (finished) return
      report('Petición lenta (más de ' + Math.round(slowMs / 1000) + ' s): ' + method + ' ' + path, { level: 'warning', method, url: path })
    }, slowMs)
    if (slow.unref) slow.unref()

    const fiveXx = () => {
      if (res.statusCode >= 500 && !res.trialogicReported) {
        res.trialogicReported = true
        return report('HTTP ' + res.statusCode + ' · ' + method + ' ' + path, { level: 'error', method, url: path, status: res.statusCode })
      }
      return Promise.resolve()
    }

    if (o.serverless && typeof res.end === 'function') {
      const originalEnd = res.end
      res.end = function () {
        const args = arguments
        const self = this
        if (self.statusCode >= 500 && !self.trialogicReported) {
          fiveXx().then(() => originalEnd.apply(self, args))
          return self
        }
        return originalEnd.apply(self, args)
      }
    }

    res.on('finish', () => { finished = true; clearTimeout(slow); fiveXx() })
    res.on('close', () => { finished = true; clearTimeout(slow) })
  } catch (e) {
    /* vigilar nunca debe romper la petición */
  }
}

module.exports = { report, monitorRequest, cleanPath }
