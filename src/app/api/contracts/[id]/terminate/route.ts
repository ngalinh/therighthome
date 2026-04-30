import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextTransactionCode } from "@/lib/codes";

const schema = z.object({
  reason: z.enum(["EXPIRED", "TERMINATED", "TERMINATED_LOST_DEPOSIT"]),
  terminatedAt: z.string().optional(),
  depositRefund: z.string().optional(), // VND, only used when reason!=LOST_DEPOSIT
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const at = d.terminatedAt ? new Date(d.terminatedAt) : new Date();

  await prisma.$transaction(async (tx) => {
    // Auto-record deposit loss as revenue if applicable
    if (d.reason === "TERMINATED_LOST_DEPOSIT" && c.depositAmount > 0n) {
      const cat = await tx.transactionCategory.findFirst({
        where: { type: "INCOME", name: { contains: "cọc" } },
      });
      const code = await nextTransactionCode(c.buildingId, "INCOME");
      const customer = await tx.contractCustomer.findFirst({
        where: { contractId: id, isPrimary: true },
        include: { customer: true },
      });
      await tx.transaction.create({
        data: {
          buildingId: c.buildingId,
          code,
          date: at,
          type: "INCOME",
          amount: c.depositAmount,
          content: `Tiền cọc mất - HĐ ${c.code}`,
          categoryId: cat?.id,
          partyKind: "CUSTOMER",
          customerId: customer?.customerId,
          countInBR: true,
          accountingMonth: at.getMonth() + 1,
          accountingYear: at.getFullYear(),
          createdById: session.user.id,
        },
      });
    }

    await tx.contract.update({
      where: { id },
      data: {
        status: d.reason,
        terminatedAt: at,
        depositRefund: d.depositRefund ? BigInt(d.depositRefund) : null,
      },
    });

    // Free room if no other active contracts
    const stillActive = await tx.contract.count({ where: { roomId: c.roomId, status: "ACTIVE" } });
    if (stillActive === 0) {
      await tx.room.update({ where: { id: c.roomId }, data: { status: "AVAILABLE" } });
    }
  });

  return NextResponse.json({ ok: true });
}
