import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidBucket, readStoredFile } from "@/lib/storage";
import path from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ bucket: string; filename: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { bucket, filename } = await ctx.params;
  if (!isValidBucket(bucket)) return new NextResponse("Bad bucket", { status: 400 });

  try {
    const buf = await readStoredFile(bucket, filename);
    const ext = path.extname(filename).toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
