import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  isCash: z.boolean().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankBin: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  buildingIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { buildingIds, ...data } = parsed.data;
  await prisma.paymentMethod.update({
    where: { id },
    data: {
      ...data,
      ...(buildingIds !== undefined && {
        buildings: { set: buildingIds.map((bid) => ({ id: bid })) },
      }),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const used = await prisma.transaction.count({ where: { paymentMethodId: id } });
  if (used > 0) return NextResponse.json({ error: "PTTT đang được dùng" }, { status: 400 });
  await prisma.paymentMethod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
