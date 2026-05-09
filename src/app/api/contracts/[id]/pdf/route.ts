import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { convertContractDocxToPdf } from "@/lib/docx";

export const runtime = "nodejs";
// LibreOffice cold-start can take a few seconds.
export const maxDuration = 60;

// GET /api/contracts/:id/pdf
// Returns { url } pointing at a PDF rendered from the contract's
// generatedDocxUrl. Conversion is cached on disk; subsequent calls are cheap.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, buildingId: true, generatedDocxUrl: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, contract.buildingId, "contract.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!contract.generatedDocxUrl) {
    return NextResponse.json({ error: "Chưa có hợp đồng đã tạo" }, { status: 404 });
  }

  try {
    const url = await convertContractDocxToPdf(contract.generatedDocxUrl);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contract pdf] failed:", msg, e);
    return NextResponse.json({ error: `Convert PDF thất bại: ${msg}` }, { status: 500 });
  }
}
