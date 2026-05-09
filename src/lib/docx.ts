import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { saveBuffer } from "@/lib/storage";

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), "storage");

/**
 * Render a contract DOCX from an uploaded template.
 * Template uses {placeholders} like {ten_khach}, {gia_thue}, etc.
 */
export async function renderContractDocx(templateRelUrl: string, data: Record<string, string | number>): Promise<string> {
  // templateRelUrl is like /api/files/templates/xxx.docx
  const m = templateRelUrl.match(/\/api\/files\/(templates)\/(.+)$/);
  if (!m) throw new Error("Invalid template URL");
  const filename = m[2];
  const content = await fs.readFile(path.join(STORAGE_PATH, "templates", path.basename(filename)));

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{", end: "}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  const out = doc.getZip().generate({ type: "nodebuffer" });
  return saveBuffer("contracts", out, ".docx");
}

/**
 * Convert a stored .docx (under contracts/ bucket) to PDF, caching the result
 * next to it on disk. Returns the relative `/api/files/contracts/...pdf` URL.
 *
 * Idempotent: if the PDF already exists on disk, it's returned as-is.
 */
export async function convertContractDocxToPdf(docxRelUrl: string): Promise<string> {
  const m = docxRelUrl.match(/\/api\/files\/contracts\/(.+\.docx)$/);
  if (!m) throw new Error("Invalid docx URL");
  const docxName = path.basename(m[1]);
  const pdfName = docxName.replace(/\.docx$/, ".pdf");
  const docxPath = path.join(STORAGE_PATH, "contracts", docxName);
  const pdfPath = path.join(STORAGE_PATH, "contracts", pdfName);

  try {
    await fs.access(pdfPath);
    return `/api/files/contracts/${pdfName}`;
  } catch {
    // not cached; convert below
  }

  // libreoffice expects --outdir; it picks the output filename based on the
  // input. We convert into a temp dir then move into the contracts bucket so
  // a half-written PDF never gets served.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "docx2pdf-"));
  const homeDir = path.join(tmpDir, "home");
  await fs.mkdir(homeDir, { recursive: true });
  try {
    await runLibreOffice(docxPath, tmpDir, homeDir);
    const tmpPdf = path.join(tmpDir, docxName.replace(/\.docx$/, ".pdf"));
    await fs.access(tmpPdf);
    await fs.rename(tmpPdf, pdfPath).catch(async () => {
      // Fallback if /tmp and storage are on different devices.
      const buf = await fs.readFile(tmpPdf);
      await fs.writeFile(pdfPath, buf);
    });
    return `/api/files/contracts/${pdfName}`;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runLibreOffice(docxPath: string, outDir: string, homeDir: string): Promise<void> {
  // Each invocation gets a unique HOME so concurrent conversions don't fight
  // over LibreOffice's user profile lock.
  const userProfile = `file://${path.join(homeDir, "lo-" + crypto.randomBytes(4).toString("hex"))}`;
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "libreoffice",
      [
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        `-env:UserInstallation=${userProfile}`,
        "--convert-to", "pdf",
        "--outdir", outDir,
        docxPath,
      ],
      { env: { ...process.env, HOME: homeDir } },
    );
    let stderr = "";
    proc.stderr.on("data", (b) => { stderr += b.toString(); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`libreoffice exit ${code}: ${stderr.trim() || "unknown error"}`));
    });
  });
}
