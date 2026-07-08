import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

// Mark a genuinely-zero invoice as "Không phát sinh" (WAIVED). No transaction is
// created — there is nothing to collect. Only valid while the invoice total is
// still 0; once fees are added the normal payment flow takes over.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (inv.totalAmount !== 0n) {
    return NextResponse.json({ error: "Chỉ áp dụng cho hoá đơn 0đ" }, { status: 400 });
  }
  if (inv.status === "CANCELLED" || inv.status === "PAID" || inv.status === "WAIVED") {
    return NextResponse.json({ error: "Trạng thái hoá đơn không hợp lệ" }, { status: 400 });
  }

  await prisma.invoice.update({ where: { id }, data: { status: "WAIVED" } });
  return NextResponse.json({ ok: true });
}
