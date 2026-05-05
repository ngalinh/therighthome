import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";

// Upload default contract template per kind. Admin only.
// FormData: file (.docx), kind: "chdv" | "vpIndividual" | "vpCompany"
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  const kind = fd.get("kind") as string | null;
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!f.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx allowed" }, { status: 400 });
  }
  if (!kind || !["chdv", "vpIndividual", "vpCompany"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const url = await saveFile("templates", f, ".docx");
  const field =
    kind === "chdv" ? "defaultContractTemplateChdv" :
    kind === "vpIndividual" ? "defaultContractTemplateVpIndividual" :
    "defaultContractTemplateVpCompany";
  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, [field]: url },
    update: { [field]: url },
  });
  return NextResponse.json({ url });
}
