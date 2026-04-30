import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const url = await saveFile("contracts", f);
  await prisma.contract.update({ where: { id }, data: { contractFileUrl: url } });
  return NextResponse.json({ url });
}
