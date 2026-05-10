import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const patchSchema = z.object({
  amount: z.string(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const newAmount = BigInt(parsed.data.amount);
  if (newAmount <= 0n) return NextResponse.json({ error: "Số tiền phải > 0" }, { status: 400 });

  const payment = await prisma.invoicePayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.invoiceId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const delta = newAmount - payment.amount;
    await tx.invoicePayment.update({ where: { id: paymentId }, data: { amount: newAmount } });
    await tx.transaction.update({
      where: { id: payment.transactionId },
      data: { amount: newAmount },
    });
    const updatedPaid = inv.paidAmount + delta;
    const status = updatedPaid >= inv.totalAmount ? "PAID" : updatedPaid > 0n ? "PARTIAL" : "PENDING";
    await tx.invoice.update({
      where: { id },
      data: { paidAmount: updatedPaid, status },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payment = await prisma.invoicePayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.invoiceId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Cascade from Transaction → InvoicePayment is set in schema, so deleting
    // the transaction also removes the payment row.
    await tx.transaction.delete({ where: { id: payment.transactionId } });
    const updatedPaid = inv.paidAmount - payment.amount;
    const status = updatedPaid >= inv.totalAmount ? "PAID" : updatedPaid > 0n ? "PARTIAL" : "PENDING";
    await tx.invoice.update({
      where: { id },
      data: { paidAmount: updatedPaid, status },
    });
  });

  return NextResponse.json({ ok: true });
}
