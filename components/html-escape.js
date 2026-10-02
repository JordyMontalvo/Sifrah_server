/**
 * Escapado para el contenido que se inserta en el HTML de los correos.
 *
 * Los nombres, asuntos y mensajes los escribe una persona. Si se interpolan
 * tal cual en la plantilla, el navegador de correo los interpreta como
 * marcado y se pueden construir mensajes arbitrarios que salen firmados desde
 * el dominio de Sifrah.
 */

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// El asunto viaja como cabecera del correo: un salto de línea permitiría
// añadir destinatarios o cabeceras nuevas.
function escapeSubject(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

// Un href sólo debe poder apuntar a http(s); así no acaba siendo javascript:
function escapeUrl(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return /^https?:\/\//i.test(raw) ? escapeHtml(raw) : '';
}

module.exports = { escapeHtml, escapeSubject, escapeUrl };
