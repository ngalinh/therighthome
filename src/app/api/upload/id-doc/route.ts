import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

// Generic upload for ID-card / business-license images. Stores under
// the "id-cards" bucket and returns front/back URLs (whichever provided).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const front = form.get("front") as File | null;
    const back = form.get("back") as File | null;
    if (!front && !back) {
      return NextResponse.json({ error: "Cần ít nhất 1 ảnh" }, { status: 400 });
    }
    const [frontUrl, backUrl] = await Promise.all([
      front ? saveFile("id-cards", front) : Promise.resolve(null),
      back ? saveFile("id-cards", back) : Promise.resolve(null),
    ]);
    return NextResponse.json({ frontUrl, backUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[upload id-doc] failed:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
