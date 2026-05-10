import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "settings.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  // kind = "individual" (default → contractTemplateUrl) | "company" (→ contractTemplateUrlCompany).
  const kind = (fd.get("kind") as string | null) ?? "individual";
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!f.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx allowed" }, { status: 400 });
  }
  if (!["individual", "company"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const url = await saveFile("templates", f, ".docx");
  const field = kind === "company" ? "contractTemplateUrlCompany" : "contractTemplateUrl";
  await prisma.buildingSetting.upsert({
    where: { buildingId: id },
    create: { buildingId: id, [field]: url },
    update: { [field]: url },
  });
  return NextResponse.json({ url, kind });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "settings.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const kind = req.nextUrl.searchParams.get("kind") ?? "individual";
  if (!["individual", "company"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const field = kind === "company" ? "contractTemplateUrlCompany" : "contractTemplateUrl";
  await prisma.buildingSetting.update({
    where: { buildingId: id },
    data: { [field]: null },
  });
  return NextResponse.json({ ok: true });
}
