import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload default contract template per kind. Admin only.
// FormData: file (.docx), kind: "chdv" | "vpIndividual" | "vpCompany"
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const fd = await req.formData();
    const f = fd.get("file") as File | null;
    const kind = fd.get("kind") as string | null;
    if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (!f.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx allowed" }, { status: 400 });
    }
    if (f.size === 0) {
      return NextResponse.json({ error: "File rỗng" }, { status: 400 });
    }
    if (!kind || !["chdv", "vpIndividual", "vpCompany"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const url = await saveFile("templates", f, ".docx");
    const data =
      kind === "chdv" ? { defaultContractTemplateChdv: url } :
      kind === "vpIndividual" ? { defaultContractTemplateVpIndividual: url } :
      { defaultContractTemplateVpCompany: url };
    await prisma.appSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[app-settings/template POST] failed:", msg, e);
    return NextResponse.json({ error: `Upload thất bại: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const kind = req.nextUrl.searchParams.get("kind");
    if (!kind || !["chdv", "vpIndividual", "vpCompany"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const data =
      kind === "chdv" ? { defaultContractTemplateChdv: null } :
      kind === "vpIndividual" ? { defaultContractTemplateVpIndividual: null } :
      { defaultContractTemplateVpCompany: null };
    await prisma.appSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[app-settings/template DELETE] failed:", msg, e);
    return NextResponse.json({ error: `Xoá thất bại: ${msg}` }, { status: 500 });
  }
}
