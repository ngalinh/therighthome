// Backup every 3 days: pg_dump + storage archive → upload to Google Drive folder.
// Runs immediately on start, then sleeps 3 days between runs.
const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  GOOGLE_DRIVE_BACKUP_FOLDER_ID,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  STORAGE_PATH = "/app/storage",
} = process.env;

const BACKUP_DIR = "/app/backups";
const INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function pgDump(file) {
  return new Promise((resolve, reject) => {
    const cmd = `PGPASSWORD='${POSTGRES_PASSWORD}' pg_dump -h db -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F c -f ${file}`;
    exec(cmd, (err, _stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
  });
}

function tarStorage(file) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(STORAGE_PATH)) {
      console.log(`[backup] storage path ${STORAGE_PATH} not found, skipping`);
      return resolve(null);
    }
    const cmd = `tar -czf ${file} -C ${path.dirname(STORAGE_PATH)} ${path.basename(STORAGE_PATH)}`;
    exec(cmd, (err, _stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(file)));
  });
}

function driveClient() {
  if (
    !GOOGLE_DRIVE_BACKUP_FOLDER_ID ||
    !GOOGLE_OAUTH_CLIENT_ID ||
    !GOOGLE_OAUTH_CLIENT_SECRET ||
    !GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    return null;
  }
  const auth = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth });
}

async function uploadToDrive(drive, filePath) {
  if (!drive) {
    console.log("[backup] Drive not configured, skipping upload (file kept locally)");
    return;
  }
  const res = await drive.files.create({
    requestBody: {
      name: path.basename(filePath),
      parents: [GOOGLE_DRIVE_BACKUP_FOLDER_ID],
    },
    media: {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    },
    fields: "id",
  });
  console.log(`[backup] uploaded ${path.basename(filePath)} to Drive id=${res.data.id}`);
}

function pruneOld(days = 30) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    const p = path.join(BACKUP_DIR, f);
    const st = fs.statSync(p);
    if (st.mtimeMs < cutoff) {
      fs.unlinkSync(p);
      console.log(`[backup] pruned old file: ${f}`);
    }
  }
}

async function pruneOldDrive(drive, days = 30) {
  if (!drive) return;
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  let pageToken = null;
  let deleted = 0;
  do {
    const res = await drive.files.list({
      q: `'${GOOGLE_DRIVE_BACKUP_FOLDER_ID}' in parents and createdTime < '${cutoff}' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageToken: pageToken || undefined,
    });
    for (const file of res.data.files || []) {
      await drive.files.delete({ fileId: file.id });
      console.log(`[backup] Drive: pruned old file: ${file.name}`);
      deleted++;
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  if (deleted === 0) console.log("[backup] Drive: no old files to prune");
}

async function runOnce() {
  const stamp = ts();
  const dbFile = path.join(BACKUP_DIR, `${POSTGRES_DB}-${stamp}.dump`);
  const storageFile = path.join(BACKUP_DIR, `storage-${stamp}.tar.gz`);

  console.log(`[backup] starting database dump → ${dbFile}`);
  await pgDump(dbFile);
  console.log("[backup] database dump done");

  console.log(`[backup] starting storage archive → ${storageFile}`);
  const storageResult = await tarStorage(storageFile);
  if (storageResult) console.log("[backup] storage archive done");

  const drive = driveClient();
  await uploadToDrive(drive, dbFile);
  if (storageResult) await uploadToDrive(drive, storageFile);

  pruneOld(30);
  await pruneOldDrive(drive, 30);
}

async function loop() {
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error("[backup] failed:", e.message);
    }
    console.log(`[backup] next run in 3 days`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop();
