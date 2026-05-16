import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: invoiceId, lineId } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { buildingId: true } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fd = await req.formData();
  const which = String(fd.get("which") || "");
  const f = fd.get("file") as File | null;
  if (!f || !["start", "end"].includes(which)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const url = await saveFile("electricity", f);
  await prisma.invoiceElectricityLine.update({
    where: { id: lineId },
    data: which === "start" ? { startPhotoUrl: url } : { endPhotoUrl: url },
  });
  return NextResponse.json({ url });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: invoiceId, lineId } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { buildingId: true } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const which = new URL(req.url).searchParams.get("which");
  if (!which || !["start", "end"].includes(which)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await prisma.invoiceElectricityLine.update({
    where: { id: lineId },
    data: which === "start" ? { startPhotoUrl: null } : { endPhotoUrl: null },
  });
  return NextResponse.json({ ok: true });
}
