#!/usr/bin/env node
/**
 * Dump de MongoDB y subida a Bunny.net Storage.
 *
 * Uso local:
 *   node scripts/mongo-backup-bunny.js
 *
 * Heroku Scheduler:
 *   npm run backup:mongo
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function normalizeMongoUri(raw) {
  if (!raw) return "";
  let uri = String(raw).trim();
  if (
    (uri.startsWith('"') && uri.endsWith('"')) ||
    (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }
  const assignMatch = uri.match(/^(?:MONGODB_URI|DB_URL(?:_PROD|_DEV)?)\s*=\s*(.+)$/i);
  if (assignMatch) uri = assignMatch[1].trim();
  return uri;
}

function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
}

function resolveMongoUri() {
  const candidates = [
    ["DB_URL", process.env.DB_URL],
    ["MONGODB_URI", process.env.MONGODB_URI],
    ["DB_URL_PROD", process.env.DB_URL_PROD],
    ["DB_URL_DEV", process.env.DB_URL_DEV],
  ];

  for (const [name, value] of candidates) {
    const uri = normalizeMongoUri(value);
    if (uri) return { uri, source: name };
  }
  return { uri: "", source: null };
}

function validateMongoUri(uri, source) {
  if (!uri) {
    fail("Define DB_URL o MONGODB_URI en Heroku Config Vars.");
  }
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    fail(
      `${source} debe empezar con mongodb:// o mongodb+srv://. ` +
        `Revisa Heroku → Settings → Config Vars. Valor (enmascarado): ${maskMongoUri(uri)}`
    );
  }
  if (/\s/.test(uri)) {
    fail(
      `${source} contiene espacios. Si la contraseña tiene caracteres especiales, codifícala (ej. @ → %40).`
    );
  }
  const body = uri.replace(/^mongodb\+srv:\/\//i, "").replace(/^mongodb:\/\//i, "");
  const atCount = (body.match(/@/g) || []).length;
  if (atCount > 1) {
    fail(
      `${source} tiene varios '@'. Si la contraseña incluye @, codifícala como %40.`
    );
  }
}

const { uri: MONGODB_URI, source: MONGODB_URI_SOURCE } = resolveMongoUri();
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME;
const STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);
const BACKUP_PREFIX = process.env.BACKUP_PREFIX || "sifrah-mongo-backup";

function fail(message) {
  console.error(`[backup] ERROR: ${message}`);
  process.exit(1);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function assertMongodump() {
  const check = spawnSync("mongodump", ["--version"], { encoding: "utf8" });
  if (check.error || check.status !== 0) {
    fail(
      "mongodump no está instalado. En Heroku añade el buildpack apt y redeploya."
    );
  }
}

function ensureDatabaseInUri(uri) {
  const defaultDb = process.env.BACKUP_DB_NAME || "sifrah";
  if (!/^mongodb:\/\//i.test(uri)) return uri;

  const qIndex = uri.indexOf("?");
  const query = qIndex >= 0 ? uri.slice(qIndex) : "";
  const base = qIndex >= 0 ? uri.slice(0, qIndex) : uri;

  if (/^mongodb:\/\/[^/]+\/[^/]+/.test(base)) {
    return uri;
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${defaultDb}${query}`;
}

function buildMongodumpArgs(uri, archivePath) {
  const connectionUri = ensureDatabaseInUri(uri);
  return [connectionUri, `--archive=${archivePath}`, "--gzip"];
}

function mongodumpEnv() {
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.DB_URL;
  delete env.DB_URL_PROD;
  delete env.DB_URL_DEV;
  return env;
}

function runMongodump(archivePath) {
  const args = buildMongodumpArgs(MONGODB_URI, archivePath);
  const connectionUri = args[0];

  console.log(
    `[backup] Ejecutando mongodump (origen: ${MONGODB_URI_SOURCE}, uri: ${maskMongoUri(connectionUri)})...`
  );

  const result = spawnSync("mongodump", args, {
    stdio: "inherit",
    env: mongodumpEnv(),
  });

  if (result.error) {
    fail(`mongodump falló: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`mongodump salió con código ${result.status}`);
  }

  const stats = fs.statSync(archivePath);
  console.log(
    `[backup] Dump creado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
  );
}

async function uploadToBunny(archivePath, fileName) {
  console.log(`[backup] Subiendo ${fileName} a Bunny.net Storage (Zona: ${STORAGE_ZONE})...`);
  
  const fileStream = fs.createReadStream(archivePath);
  const url = `https://${STORAGE_HOSTNAME}/${STORAGE_ZONE}/backups/${fileName}`;
  
  try {
    const response = await axios.put(url, fileStream, {
      headers: {
        AccessKey: STORAGE_PASSWORD,
        "Content-Type": "application/octet-stream"
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.data && response.data.HttpCode === 201) {
      console.log(`[backup] Subido con éxito: ${fileName}`);
    } else {
      console.log(`[backup] Subido con éxito.`);
    }
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    fail(`Error al subir a Bunny.net: ${errorMsg}`);
  }
}

async function cleanupOldBackups() {
  if (!RETENTION_DAYS || RETENTION_DAYS <= 0) {
    return;
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  console.log(`[backup] Limpiando backups en Bunny.net anteriores a ${RETENTION_DAYS} días...`);

  const url = `https://${STORAGE_HOSTNAME}/${STORAGE_ZONE}/backups/`;

  try {
    const response = await axios.get(url, {
      headers: {
        AccessKey: STORAGE_PASSWORD,
        Accept: "application/json"
      }
    });

    const files = response.data || [];
    let deleted = 0;

    for (const file of files) {
      if (file.IsDirectory === false && file.ObjectName.startsWith(BACKUP_PREFIX)) {
        const fileDate = new Date(file.ServerUpdateTime).getTime();
        if (fileDate < cutoff) {
          console.log(`[backup] Eliminando archivo antiguo: ${file.ObjectName}`);
          const deleteUrl = `https://${STORAGE_HOSTNAME}/${STORAGE_ZONE}/backups/${file.ObjectName}`;
          await axios.delete(deleteUrl, {
            headers: {
              AccessKey: STORAGE_PASSWORD
            }
          });
          deleted += 1;
        }
      }
    }

    console.log(`[backup] Backups antiguos eliminados: ${deleted}`);
  } catch (error) {
    console.error(`[backup] Error durante la limpieza: ${error.message}`);
  }
}

async function main() {
  validateMongoUri(MONGODB_URI, MONGODB_URI_SOURCE || "DB_URL/MONGODB_URI");
  if (!STORAGE_ZONE || !STORAGE_PASSWORD) {
    fail("Define BUNNY_STORAGE_ZONE_NAME y BUNNY_STORAGE_PASSWORD.");
  }

  assertMongodump();

  const fileName = `${BACKUP_PREFIX}-${timestamp()}.gz`;
  const archivePath = path.join(os.tmpdir(), fileName);

  try {
    runMongodump(archivePath);
    await uploadToBunny(archivePath, fileName);
    await cleanupOldBackups();
    console.log("[backup] Completado con éxito.");
  } finally {
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
  }
}

main().catch((err) => {
  console.error("[backup] ERROR:", err.message || err);
  process.exit(1);
});
