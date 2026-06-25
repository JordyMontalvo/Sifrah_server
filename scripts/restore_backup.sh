#!/bin/bash
set -e
source ~/.nvm/nvm.sh
cd /var/www/sifrah-server

URI=$(node -e "require('dotenv').config({ quiet: true }); const u=process.env.DB_URL||process.env.MONGODB_URI; if(!u)process.exit(1); process.stdout.write(u);")
DB=$(node -e "require('dotenv').config({ quiet: true }); process.stdout.write(process.env.DB_NAME||'sifrah');")
ARCHIVE="${1:-/tmp/sifrah-backup-1782358644672.gz}"

if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: no existe $ARCHIVE"
  exit 1
fi

echo "=== Deteniendo sifrah-server ==="
pm2 stop sifrah-server || true

echo "=== Restaurando backup en DB: $DB ==="
mongorestore --uri="$URI" --gzip --archive="$ARCHIVE" --drop --nsInclude="${DB}.*"

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
