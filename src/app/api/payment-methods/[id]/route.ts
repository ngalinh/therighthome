import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const used = await prisma.transaction.count({ where: { paymentMethodId: id } });
  if (used > 0) return NextResponse.json({ error: "PTTT đang được dùng" }, { status: 400 });
  await prisma.paymentMethod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
