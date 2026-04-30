import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextTransactionCode } from "@/lib/codes";

const paySchema = z.object({
  amount: z.string(),
  paymentMethodId: z.string().optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { contract: { include: { customers: { include: { customer: true }, where: { isPrimary: true } } } } },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = paySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const amount = BigInt(parsed.data.amount);
  if (amount <= 0n) return NextResponse.json({ error: "Số tiền phải > 0" }, { status: 400 });

  // Find rent revenue category
  const cat = await prisma.transactionCategory.findFirst({
    where: { type: "INCOME", name: { contains: "thuê" } },
  });

  const customer = inv.contract.customers[0]?.customer;

  await prisma.$transaction(async (tx) => {
    const code = await nextTransactionCode(inv.buildingId, "INCOME");
    const txn = await tx.transaction.create({
      data: {
        buildingId: inv.buildingId,
        code,
        date: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
        type: "INCOME",
        amount,
        content: `Thanh toán hoá đơn ${inv.code}`,
        notes: parsed.data.notes,
        categoryId: cat?.id,
        paymentMethodId: parsed.data.paymentMethodId,
        partyKind: "CUSTOMER",
        customerId: customer?.id,
        invoiceId: inv.id,
        countInBR: true,
        accountingMonth: inv.month,
        accountingYear: inv.year,
        createdById: session.user.id,
      },
    });
    await tx.invoicePayment.create({
      data: { invoiceId: inv.id, transactionId: txn.id, amount, paidAt: txn.date },
    });
    const paid = inv.paidAmount + amount;
    const status = paid >= inv.totalAmount ? "PAID" : "PARTIAL";
    await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status } });
  });

  return NextResponse.json({ ok: true });
}
