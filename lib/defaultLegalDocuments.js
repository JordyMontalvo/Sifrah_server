export const DEFAULT_LEGAL_UPDATED = "2026-09-05T15:00:00.000Z";

export const DEFAULT_LEGAL_DOCUMENTS = {
  terms: {
    title: "Términos y condiciones",
    html: `
<p>Estos términos regulan el uso de la plataforma SIFRAH (sitio web y aplicación), incluyendo registro, afiliación, compras, red, retiros y servicios asociados. Al crear una cuenta o marcar “Acepto”, confirmas que leíste y aceptas este documento.</p>
<h2>1. Quién puede usar SIFRAH</h2>
<p>Debes proporcionar datos verídicos (nombre, DNI, correo, celular y demás datos de perfil). El uso de la plataforma implica cumplir las reglas de conducta, pagos y red de SIFRAH.</p>
<h2>2. Tu cuenta</h2>
<ul>
<li>Eres responsable de tu contraseña y del uso de tu sesión.</li>
<li>El código de patrocinador identifica a quien te invita a la red.</li>
<li>SIFRAH puede pedir verificación adicional de identidad cuando sea necesario.</li>
</ul>
<h2>3. Compras, afiliación y pagos</h2>
<p>Los pedidos, paquetes de afiliación y canjes se procesan según el método de pago que elijas (saldo, transferencia, pago en oficina, tarjeta u otros habilitados). Los montos, puntos y estados del pedido se muestran en tu cuenta. Un pago no se considera confirmado hasta que SIFRAH o el procesador lo validen.</p>
<h2>4. Retiros y transferencias de saldo</h2>
<p>Solo puedes retirar o transferir el saldo disponible. El Bono Ahorro y otros saldos restringidos no se mezclan con el retiro. SIFRAH puede pedir datos bancarios, Yape o Plin para entregar el dinero y rechazar solicitudes incompletas o que superen el disponible.</p>
<h2>5. Red y contenidos</h2>
<p>La información de tu red, comisiones y materiales se muestra para gestionar tu actividad en SIFRAH. No está permitido usar la plataforma para fraude, spam o suplantación de identidad.</p>
<h2>6. Limitación</h2>
<p>SIFRAH procura que el servicio esté disponible, pero puede haber mantenimientos, cortes o demoras de terceros (bancos, pasarelas, mensajería). El contenido de estos términos puede actualizarse; la versión vigente es la publicada en esta página.</p>
<h2>7. Contacto</h2>
<p>Si tienes dudas sobre estos términos, escríbenos por los canales de soporte de SIFRAH publicados en la aplicación.</p>
`.trim(),
  },
  privacy: {
    title: "Política de privacidad",
    html: `
<p>Esta política explica qué datos personales trata SIFRAH, para qué los usa y cómo puedes ejercer tus derechos. Aplica al sitio web y a la aplicación.</p>
<h2>1. Datos que recopilamos</h2>
<ul>
<li>Identidad: nombre, apellido, DNI, fecha de nacimiento, foto de perfil.</li>
<li>Contacto: correo, celular, país, ciudad y dirección.</li>
<li>Cuenta: código de invitación, contraseña (almacenada de forma segura) y sesión.</li>
<li>Pagos y retiros: banco, tipo de cuenta, número, CCI, titular, Yape, Plin y comprobantes que subas.</li>
<li>Actividad: pedidos, afiliación, red, comisiones, retiros y mensajes de soporte.</li>
</ul>
<h2>2. Para qué los usamos</h2>
<p>Crear y mantener tu cuenta, procesar compras y pagos, pagar retiros, mostrar tu red, enviarte avisos del servicio (por ejemplo, recuperar contraseña) y cumplir obligaciones legales o de seguridad.</p>
<h2>3. Con quién se comparten</h2>
<p>No vendemos tus datos. Podemos compartirlos con procesadores de pago, hosting, envío de correos y con tu red solo en la medida necesaria para el funcionamiento de SIFRAH (por ejemplo, tu nombre visible para tu patrocinador). También si una autoridad competente lo requiere.</p>
<h2>4. Conservación y seguridad</h2>
<p>Conservamos los datos mientras tu cuenta esté activa y el tiempo adicional que exija la ley. Aplicamos medidas técnicas razonables; ningún sistema es 100 % invulnerable, así que también debes cuidar tu contraseña.</p>
<h2>5. Tus derechos</h2>
<p>Puedes acceder, rectificar o actualizar varios datos desde Mi perfil. Para eliminar la cuenta u otras solicitudes sobre tus datos, contacta a soporte SIFRAH. En Perú, estos derechos se ejercen conforme a la Ley N.° 29733 de Protección de Datos Personales.</p>
<h2>6. Menores</h2>
<p>El registro de menores o extranjeros sigue las reglas del formulario de alta. Quien registra declara que la información es veraz y que cuenta con autorización cuando corresponda.</p>
<h2>7. Contacto</h2>
<p>Para preguntas sobre privacidad, usa el soporte de SIFRAH dentro de la app o los canales oficiales publicados en la plataforma.</p>
`.trim(),
  },
};

export function sanitizeLegalHtml(input) {
  let html = String(input || "");
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<\/?(iframe|object|embed|link|meta|form|input|button|svg)[^>]*>/gi, "");
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/javascript\s*:/gi, "");
  return html.trim();
}

export function legalTextLength(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}
