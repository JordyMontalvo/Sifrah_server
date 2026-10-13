// Freno de peticiones por cliente, pensado para endpoints que no exigen sesion
// y que cuestan dinero o trabajo en cada llamada.
//
// El conteo es por direccion IP. Esto no servia antes, porque nginx no enviaba
// la direccion real y practicamente todo el mundo llegaba como 127.0.0.1; desde
// que eso se corrigio, la direccion que se recibe es la del cliente de verdad.
//
// Aun asi se elige un limite holgado a proposito: muchos socios entran desde el
// movil y varias conexiones moviles comparten una misma salida a internet, de
// modo que un limite estrecho dejaria fuera a gente que no ha hecho nada. Lo
// que se busca no es afinar, sino que una sola persona no pueda lanzar
// peticiones sin fin.
//
// Los contadores viven en la memoria del proceso. El servidor corre en uno
// solo, asi que basta; si algun dia se reparte en varios, cada uno llevaria su
// cuenta y el freno seria mas laxo, nunca mas estricto.

const MAX_CLAVES = 10000; // tope para que la memoria no crezca sin control

const contadores = new Map();

function limpiar(ahora) {
  for (const [clave, entrada] of contadores) {
    if (ahora - entrada.inicio > entrada.ventanaMs) contadores.delete(clave);
  }
}

/**
 * Devuelve los segundos que faltan para poder reintentar, o 0 si puede pasar.
 * Cuenta la peticion actual.
 */
export function consumir(clave, { maximo, ventanaMs }) {
  try {
    if (!clave) return 0; // sin forma de identificar al cliente, no se frena

    const id = String(clave);
    const ahora = Date.now();

    if (contadores.size > MAX_CLAVES) limpiar(ahora);
    if (contadores.size > MAX_CLAVES) contadores.clear();

    let entrada = contadores.get(id);
    if (!entrada || ahora - entrada.inicio > ventanaMs) {
      entrada = { cuenta: 0, inicio: ahora, ventanaMs };
    }

    entrada.cuenta += 1;
    contadores.set(id, entrada);

    if (entrada.cuenta > maximo) {
      const restante = entrada.ventanaMs - (ahora - entrada.inicio);
      return Math.max(1, Math.ceil(restante / 1000));
    }

    return 0;
  } catch (e) {
    return 0; // ante la duda, no se frena a nadie
  }
}
