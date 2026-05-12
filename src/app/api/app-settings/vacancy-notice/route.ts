import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vacancy-notice template stored on AppSetting (singleton row). One JSON
// column holds both kinds: { chdv: <template>, vp: <template> }. The kind is
// chosen by the caller via ?kind=chdv|vp so saving the VP template never
// overwrites the CHDV template (and vice versa).
//
// Legacy: older rows store the CHDV template flat at the top level (no chdv/vp
// keys). normalize() detects that shape and treats it as the CHDV template.

type Kind = "chdv" | "vp";
type Stored = Record<string, unknown> | null;

function parseKind(raw: string | null): Kind {
  return raw === "vp" ? "vp" : "chdv";
}

function normalize(stored: Stored): { chdv: unknown; vp: unknown } {
  if (!stored || typeof stored !== "object") return { chdv: null, vp: null };
  const hasSplit = "chdv" in stored || "vp" in stored;
  if (hasSplit) {
    return {
      chdv: (stored as { chdv?: unknown }).chdv ?? null,
      vp: (stored as { vp?: unknown }).vp ?? null,
    };
  }
  return { chdv: stored, vp: null };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = parseKind(req.nextUrl.searchParams.get("kind"));
  const row = await prisma.appSetting.findUnique({
    where: { id: 1 },
    select: { vacancyNoticeTemplate: true },
  });
  const split = normalize(row?.vacancyNoticeTemplate as Stored);
  return NextResponse.json({ template: split[kind] ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const kind = parseKind(req.nextUrl.searchParams.get("kind"));
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
  const row = await prisma.appSetting.findUnique({
    where: { id: 1 },
    select: { vacancyNoticeTemplate: true },
  });
  const split = normalize(row?.vacancyNoticeTemplate as Stored);
  const merged = { chdv: split.chdv ?? null, vp: split.vp ?? null, [kind]: body };
  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, vacancyNoticeTemplate: merged as object },
    update: { vacancyNoticeTemplate: merged as object },
  });
  return NextResponse.json({ ok: true });
}
