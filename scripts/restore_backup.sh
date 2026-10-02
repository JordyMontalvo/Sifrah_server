#!/bin/bash
#
# Restaura un backup sobre la base de datos. Es una operación destructiva:
# mongorestore --drop borra cada colección antes de reescribirla.
#
#   ./restore_backup.sh /ruta/al/backup.gz
#
# Antes de tocar nada saca un volcado de seguridad de la base actual en
# /var/backups/sifrah-pre-restore y pide confirmación escribiendo el nombre
# de la base. Para ejecutarlo sin preguntas (sólo en automatismos):
#
#   RESTORE_CONFIRM=<nombre-de-la-base> ./restore_backup.sh /ruta/al/backup.gz
#
set -euo pipefail
source ~/.nvm/nvm.sh
cd /var/www/sifrah-server

URI=$(node -e "require('dotenv').config({ quiet: true }); const u=process.env.DB_URL||process.env.MONGODB_URI; if(!u)process.exit(1); process.stdout.write(u);")
DB=$(node -e "require('dotenv').config({ quiet: true }); process.stdout.write(process.env.DB_NAME||'sifrah');")

# Sin ruta por defecto: un backup viejo olvidado en /tmp no debe poder
# sobrescribir la producción porque alguien ejecutó el script sin argumentos.
if [ $# -lt 1 ]; then
  echo "ERROR: falta la ruta del backup."
  echo "Uso: $0 /ruta/al/backup.gz"
  exit 1
fi
ARCHIVE="$1"

if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: no existe $ARCHIVE"
  exit 1
fi

if ! gzip -t "$ARCHIVE" 2>/dev/null; then
  echo "ERROR: $ARCHIVE no es un gzip válido o está incompleto."
  exit 1
fi

echo "=== Resumen de la operación ==="
echo "  Base de destino : $DB"
echo "  Archivo         : $ARCHIVE"
echo "  Tamaño          : $(du -h "$ARCHIVE" | cut -f1)"
echo "  Fecha del backup: $(date -r "$ARCHIVE" '+%Y-%m-%d %H:%M:%S')"
echo
echo "Se BORRARÁN todas las colecciones de '$DB' y se reemplazarán por las del archivo."
echo

# Confirmación explícita: hay que teclear el nombre de la base.
CONFIRM="${RESTORE_CONFIRM:-}"
if [ -z "$CONFIRM" ]; then
  if [ ! -t 0 ]; then
    echo "ERROR: sin terminal interactiva. Define RESTORE_CONFIRM=$DB si es intencionado."
    exit 1
  fi
  read -r -p "Escribe el nombre de la base para confirmar ($DB): " CONFIRM
fi

if [ "$CONFIRM" != "$DB" ]; then
  echo "Cancelado: la confirmación no coincide con '$DB'. No se ha tocado nada."
  exit 1
fi

# Red de seguridad: si el backup resulta ser el equivocado, esto es lo único
# que permite volver atrás.
SAFETY_DIR="/var/backups/sifrah-pre-restore"
SAFETY_FILE="$SAFETY_DIR/${DB}-$(date '+%Y%m%d-%H%M%S').gz"
mkdir -p "$SAFETY_DIR"

echo "=== Guardando el estado actual antes de borrar ==="
echo "    $SAFETY_FILE"
if ! mongodump --uri="$URI" --db="$DB" --gzip --archive="$SAFETY_FILE" --quiet; then
  echo "ERROR: no se pudo guardar el estado actual. Se aborta la restauración."
  rm -f "$SAFETY_FILE"
  exit 1
fi
echo "    Guardado ($(du -h "$SAFETY_FILE" | cut -f1))"

echo "=== Deteniendo sifrah-server ==="
pm2 stop sifrah-server || true

echo "=== Restaurando backup en DB: $DB ==="
if ! mongorestore --uri="$URI" --gzip --archive="$ARCHIVE" --drop --nsInclude="${DB}.*"; then
  echo
  echo "!!! LA RESTAURACIÓN HA FALLADO. La base puede haber quedado a medias."
  echo "!!! Para volver al estado anterior:"
  echo "!!!   mongorestore --uri=\"\$URI\" --gzip --archive=$SAFETY_FILE --drop --nsInclude=\"${DB}.*\""
  pm2 start sifrah-server || true
  exit 1
fi

echo "=== Reiniciando sifrah-server ==="
pm2 start sifrah-server

echo "=== Verificación ==="
node -e "
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
const url = process.env.DB_URL || process.env.MONGODB_URI;
const name = process.env.DB_NAME || 'sifrah';
(async () => {
  const c = new MongoClient(url);
  await c.connect();
  const db = c.db(name);
  const cols = await db.listCollections().toArray();
  const closeds = await db.collection('closeds').find({}).sort({date:-1}).limit(1).toArray();
  const periods = await db.collection('periods').find({status:'open'}).toArray();
  const users = await db.collection('users').countDocuments();
  console.log('colecciones:', cols.length);
  console.log('usuarios:', users);
  console.log('ultimo cierre:', closeds[0] ? closeds[0].date : 'ninguno');
  console.log('periodos abiertos:', periods.map(p => p.label || p.key).join(', ') || 'ninguno');
  await c.close();
})();
"

echo "=== RESTORE COMPLETADO ==="
echo "Copia previa al borrado guardada en: $SAFETY_FILE"
