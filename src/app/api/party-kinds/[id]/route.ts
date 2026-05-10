import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  forRevenue: z.boolean().optional(),
  forExpense: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
  await prisma.partyKindConfig.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const cfg = await prisma.partyKindConfig.findUnique({ where: { id } });
  if (!cfg) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  // Block delete if any transaction / party / maintenance task still references this code.
  const [txCount, partyCount, taskCount] = await Promise.all([
    prisma.transaction.count({ where: { partyKind: cfg.code } }),
    prisma.party.count({ where: { kind: cfg.code } }),
    prisma.maintenanceTask.count({ where: { partyKind: cfg.code } }),
  ]);
  if (txCount + partyCount + taskCount > 0) {
    return NextResponse.json({ error: "Đối tượng đang được dùng" }, { status: 400 });
  }
  await prisma.partyKindConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
