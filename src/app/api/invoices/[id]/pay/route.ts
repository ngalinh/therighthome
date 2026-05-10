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
    include: {
      contract: { include: { customers: { include: { customer: true }, where: { isPrimary: true } } } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = paySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const amount = BigInt(parsed.data.amount);
  if (amount <= 0n) return NextResponse.json({ error: "Số tiền phải > 0" }, { status: 400 });

  // Find rent revenue category (used for non-manual invoices)
  const rentCat = await prisma.transactionCategory.findFirst({
    where: { type: "INCOME", name: { contains: "thuê" } },
  });

  const customer = inv.contract.customers[0]?.customer;
  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

  await prisma.$transaction(async (tx) => {
    if (inv.isManual && inv.lineItems.length > 0 && amount === inv.totalAmount - inv.paidAmount) {
      // Pay-in-full of a manual invoice → create one transaction per line so
      // each can carry its own category + countInBR (deposits stay out of P&L).
      let totalAllocated = 0n;
      for (const line of inv.lineItems) {
        const code = await nextTransactionCode(inv.buildingId, "INCOME");
        const lineAmount = BigInt(line.amount);
        const txn = await tx.transaction.create({
          data: {
            buildingId: inv.buildingId,
            code,
            date: paidAt,
            type: "INCOME",
            amount: lineAmount,
            content: `${line.content} (HĐ ${inv.code})`,
            notes: parsed.data.notes,
            categoryId: line.categoryId ?? undefined,
            paymentMethodId: parsed.data.paymentMethodId,
            partyKind: "CUSTOMER",
            customerId: customer?.id,
            invoiceId: inv.id,
            countInBR: line.countInBR,
            accountingMonth: inv.month,
            accountingYear: inv.year,
            createdById: session.user.id,
          },
        });
        await tx.invoicePayment.create({
          data: { invoiceId: inv.id, transactionId: txn.id, amount: lineAmount, paidAt },
        });
        totalAllocated += lineAmount;
      }
      const paid = inv.paidAmount + totalAllocated;
      await tx.invoice.update({
        where: { id: inv.id },
        data: { paidAmount: paid, status: paid >= inv.totalAmount ? "PAID" : "PARTIAL" },
      });
    } else {
      // Default: single transaction for the whole payment.
      // For partial payments on a manual invoice, we still record one tx with
      // no category (the per-line breakdown only applies on full settlement).
      const code = await nextTransactionCode(inv.buildingId, "INCOME");
      // Manual invoice with a single line → use that line's category & countInBR.
      const onlyLine = inv.isManual && inv.lineItems.length === 1 ? inv.lineItems[0] : null;
      const txn = await tx.transaction.create({
        data: {
          buildingId: inv.buildingId,
          code,
          date: paidAt,
          type: "INCOME",
          amount,
          content: `Thanh toán hoá đơn ${inv.code}`,
          notes: parsed.data.notes,
          categoryId: onlyLine?.categoryId ?? (inv.isManual ? undefined : rentCat?.id),
          paymentMethodId: parsed.data.paymentMethodId,
          partyKind: "CUSTOMER",
          customerId: customer?.id,
          invoiceId: inv.id,
          countInBR: onlyLine ? onlyLine.countInBR : true,
          accountingMonth: inv.month,
          accountingYear: inv.year,
          createdById: session.user.id,
        },
      });
      await tx.invoicePayment.create({
        data: { invoiceId: inv.id, transactionId: txn.id, amount, paidAt },
      });
      const paid = inv.paidAmount + amount;
      const status = paid >= inv.totalAmount ? "PAID" : "PARTIAL";
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status } });
    }
  });

  return NextResponse.json({ ok: true });
}
