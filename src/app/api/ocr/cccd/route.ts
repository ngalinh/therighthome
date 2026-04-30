import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractCCCD } from "@/lib/gemini";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const front = form.get("front") as File | null;
  const back = form.get("back") as File | null;

  if (!front && !back) {
    return NextResponse.json({ error: "Cần ít nhất 1 ảnh CCCD" }, { status: 400 });
  }

  const images: { mimeType: string; data: string }[] = [];
  for (const f of [front, back].filter(Boolean) as File[]) {
    const buf = Buffer.from(await f.arrayBuffer());
    images.push({ mimeType: f.type || "image/jpeg", data: buf.toString("base64") });
  }

  const [result, frontUrl, backUrl] = await Promise.all([
    extractCCCD(images),
    front ? saveFile("id-cards", front) : Promise.resolve(null),
    back ? saveFile("id-cards", back) : Promise.resolve(null),
  ]);

  return NextResponse.json({ ...result, frontUrl, backUrl });
}
