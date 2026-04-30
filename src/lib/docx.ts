import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "node:fs/promises";
import path from "node:path";
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
