import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared vacancy-notice template stored on AppSetting (singleton row).
// Used so the same template appears on desktop & PWA (localStorage is
// per-device and doesn't sync).

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await prisma.appSetting.findUnique({
    where: { id: 1 },
    select: { vacancyNoticeTemplate: true },
  });
  return NextResponse.json({ template: row?.vacancyNoticeTemplate ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }
  // Soft cap to avoid abusive payloads. Real template is ~5-20 KB.
  const size = JSON.stringify(body).length;
  if (size > 256 * 1024) {
    return NextResponse.json({ error: "Template quá lớn" }, { status: 413 });
  }
  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, vacancyNoticeTemplate: body as object },
    update: { vacancyNoticeTemplate: body as object },
  });
  return NextResponse.json({ ok: true });
}
