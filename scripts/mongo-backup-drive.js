#!/usr/bin/env node
/**
 * Dump de MongoDB y subida a Google Drive.
 *
 * Uso local:
 *   node scripts/mongo-backup-drive.js
 *
 * Heroku Scheduler:
 *   npm run backup:mongo
 *
 * Variables requeridas:
 *   MONGODB_URI (o DB_URL)
 *   GOOGLE_DRIVE_CREDENTIALS_JSON  — JSON de cuenta de servicio (una línea)
 *   GOOGLE_DRIVE_FOLDER_ID         — ID de carpeta compartida con la cuenta de servicio
 *
 * Opcionales:
 *   BACKUP_RETENTION_DAYS (default: 30)
 *   BACKUP_PREFIX (default: sifrah-mongo-backup)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");
const { google } = require("googleapis");

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
const CREDENTIALS_JSON = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
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
      "mongodump no está instalado. En Heroku añade el buildpack apt y redeploya (ver docs/MONGO_BACKUP_DRIVE.md)."
    );
  }
}

function runMongodump(archivePath) {
  console.log(
    `[backup] Ejecutando mongodump (origen: ${MONGODB_URI_SOURCE}, uri: ${maskMongoUri(MONGODB_URI)})...`
  );
  const result = spawnSync(
    "mongodump",
    ["--uri", MONGODB_URI, "--archive", archivePath, "--gzip"],
    { stdio: "inherit", env: process.env }
  );

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

function getDriveClient() {
  let credentials;
  try {
    credentials = JSON.parse(CREDENTIALS_JSON);
  } catch (e) {
    fail("GOOGLE_DRIVE_CREDENTIALS_JSON no es JSON válido.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

async function uploadToDrive(drive, archivePath, fileName) {
  console.log(`[backup] Subiendo ${fileName} a Google Drive...`);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType: "application/gzip",
      body: fs.createReadStream(archivePath),
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  console.log(
    `[backup] Subido: ${response.data.name} (id: ${response.data.id})`
  );
  if (response.data.webViewLink) {
    console.log(`[backup] Enlace: ${response.data.webViewLink}`);
  }
}

async function cleanupOldBackups(drive) {
  if (!RETENTION_DAYS || RETENTION_DAYS <= 0) {
    return;
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  console.log(
    `[backup] Limpiando backups anteriores a ${RETENTION_DAYS} días...`
  );

  let pageToken;
  let deleted = 0;

  do {
    const list = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name contains '${BACKUP_PREFIX}' and trashed = false`,
      fields: "nextPageToken, files(id, name, createdTime)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of list.data.files || []) {
      const created = new Date(file.createdTime).getTime();
      if (created < cutoff) {
        await drive.files.delete({
          fileId: file.id,
          supportsAllDrives: true,
        });
        console.log(`[backup] Eliminado: ${file.name}`);
        deleted += 1;
      }
    }

    pageToken = list.data.nextPageToken;
  } while (pageToken);

  console.log(`[backup] Backups antiguos eliminados: ${deleted}`);
}

async function main() {
  validateMongoUri(MONGODB_URI, MONGODB_URI_SOURCE || "DB_URL/MONGODB_URI");
  if (!CREDENTIALS_JSON) {
    fail("Define GOOGLE_DRIVE_CREDENTIALS_JSON.");
  }
  if (!FOLDER_ID) {
    fail("Define GOOGLE_DRIVE_FOLDER_ID.");
  }

  assertMongodump();

  const fileName = `${BACKUP_PREFIX}-${timestamp()}.gz`;
  const archivePath = path.join(os.tmpdir(), fileName);

  try {
    runMongodump(archivePath);

    const drive = getDriveClient();
    await uploadToDrive(drive, archivePath, fileName);
    await cleanupOldBackups(drive);

    console.log("[backup] Completado.");
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
