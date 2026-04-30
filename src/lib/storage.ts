import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), "storage");

export type StorageBucket = "id-cards" | "contracts" | "electricity" | "templates" | "imports";

export async function saveFile(bucket: StorageBucket, file: File, ext?: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomBytes(8).toString("hex");
  const extension = ext || path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${id}${extension}`;
  const dir = path.join(STORAGE_PATH, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/api/files/${bucket}/${filename}`;
}

export async function saveBuffer(bucket: StorageBucket, buf: Buffer, ext: string): Promise<string> {
  const id = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${id}${ext}`;
  const dir = path.join(STORAGE_PATH, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);
  return `/api/files/${bucket}/${filename}`;
}

export async function readStoredFile(bucket: StorageBucket, filename: string): Promise<Buffer> {
  const safe = path.basename(filename);
  return fs.readFile(path.join(STORAGE_PATH, bucket, safe));
}

export function isValidBucket(b: string): b is StorageBucket {
  return ["id-cards", "contracts", "electricity", "templates", "imports"].includes(b);
}
