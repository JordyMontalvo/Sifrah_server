const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { MongoClient } = require("mongodb");

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

function ensureDatabaseInUri(uri, defaultDb) {
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

function mongodumpEnv() {
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.DB_URL;
  delete env.DB_URL_PROD;
  delete env.DB_URL_DEV;
  return env;
}

function hasMongodump() {
  const check = spawnSync("mongodump", ["--version"], { encoding: "utf8" });
  return !check.error && check.status === 0;
}

function backupTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function runMongodumpArchive(uri, archivePath) {
  const defaultDb = process.env.BACKUP_DB_NAME || process.env.DB_NAME || "sifrah";
  const connectionUri = ensureDatabaseInUri(uri, defaultDb);
  const args = [connectionUri, `--archive=${archivePath}`, "--gzip"];

  const result = spawnSync("mongodump", args, {
    stdio: "pipe",
    env: mongodumpEnv(),
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`mongodump no disponible: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `mongodump salió con código ${result.status}`);
  }
  if (!fs.existsSync(archivePath)) {
    throw new Error("mongodump no generó el archivo de respaldo");
  }
}

async function exportDatabaseJsonGzip(uri, dbName) {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  try {
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const dump = {
      database: dbName,
      exportedAt: new Date().toISOString(),
      collections: {},
    };

    for (const col of collections) {
      const name = col.name;
      dump.collections[name] = await db.collection(name).find({}).toArray();
    }

    return zlib.gzipSync(Buffer.from(JSON.stringify(dump), "utf8"));
  } finally {
    await client.close();
  }
}

/**
 * Genera un respaldo descargable de MongoDB.
 * @returns {{ buffer: Buffer, filename: string, method: string }}
 */
async function createDatabaseBackupBuffer() {
  const { uri } = resolveMongoUri();
  if (!uri) {
    throw new Error("No hay URI de MongoDB configurada (DB_URL / MONGODB_URI).");
  }

  const dbName = process.env.BACKUP_DB_NAME || process.env.DB_NAME || "sifrah";
  const stamp = backupTimestamp();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sifrah-backup-"));

  try {
    if (hasMongodump()) {
      const archivePath = path.join(tmpDir, `sifrah-mongo-${stamp}.gz`);
      runMongodumpArchive(uri, archivePath);
      const buffer = fs.readFileSync(archivePath);
      return {
        buffer,
        filename: `sifrah-backup-${stamp}.archive.gz`,
        method: "mongodump",
      };
    }

    const buffer = await exportDatabaseJsonGzip(uri, dbName);
    return {
      buffer,
      filename: `sifrah-backup-${stamp}.json.gz`,
      method: "json",
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
}

module.exports = {
  resolveMongoUri,
  backupTimestamp,
  createDatabaseBackupBuffer,
  hasMongodump,
};
