import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { convertDocxToPdf } from "@/lib/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/template-preview?url=/api/files/templates/<filename>.docx
// Converts the DOCX template to PDF on demand and returns the PDF url. Used
// to render an inline preview of the contract template (raw, with placeholders
// intact). Cached on disk alongside the template.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rel = req.nextUrl.searchParams.get("url") ?? "";
  const m = rel.match(/^\/api\/files\/templates\/([^/]+\.docx)$/);
  if (!m) return NextResponse.json({ error: "Invalid url" }, { status: 400 });

  try {
    const url = await convertDocxToPdf("templates", m[1]);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[template-preview] failed:", msg, e);
    return NextResponse.json({ error: `Convert PDF thất bại: ${msg}` }, { status: 500 });
  }
}
