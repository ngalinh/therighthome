// Daily backup: pg_dump → upload to Google Drive folder.
// Runs forever; sleeps to next 02:00 Asia/Ho_Chi_Minh.
const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  GOOGLE_DRIVE_BACKUP_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON = "/app/secrets/google-service-account.json",
} = process.env;

const BACKUP_DIR = "/app/backups";
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

async function uploadToDrive(filePath) {
  if (!GOOGLE_DRIVE_BACKUP_FOLDER_ID || !fs.existsSync(GOOGLE_SERVICE_ACCOUNT_JSON)) {
    console.log("[backup] Drive not configured, skipping upload (file kept locally)");
    return;
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_SERVICE_ACCOUNT_JSON,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  const drive = google.drive({ version: "v3", auth });
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
  console.log(`[backup] uploaded to Drive id=${res.data.id}`);
}

function pruneOld(days = 14) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    const p = path.join(BACKUP_DIR, f);
    const st = fs.statSync(p);
    if (st.mtimeMs < cutoff) fs.unlinkSync(p);
  }
}

async function runOnce() {
  const file = path.join(BACKUP_DIR, `${POSTGRES_DB}-${ts()}.dump`);
  console.log(`[backup] starting dump → ${file}`);
  await pgDump(file);
  console.log("[backup] dump done");
  await uploadToDrive(file);
  pruneOld();
}

function msUntilNext0200() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

async function loop() {
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error("[backup] failed:", e.message);
    }
    const wait = msUntilNext0200();
    console.log(`[backup] sleep ${Math.round(wait / 60000)} min`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

loop();
