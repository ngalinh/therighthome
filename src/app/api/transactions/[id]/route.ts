import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  date: z.string().optional(),
  amount: z.string().optional(),
  content: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  partyKind: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  partyId: z.string().nullable().optional(),
  countInBR: z.boolean().optional(),
  accountingMonth: z.number().int().min(1).max(12).optional(),
  accountingYear: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, tx.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.transaction.update({
    where: { id },
    data: {
      ...(d.date ? { date: new Date(d.date) } : {}),
      ...(d.amount ? { amount: BigInt(d.amount) } : {}),
      ...(d.content !== undefined ? { content: d.content } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
      ...(d.paymentMethodId !== undefined ? { paymentMethodId: d.paymentMethodId } : {}),
      ...(d.countInBR !== undefined ? { countInBR: d.countInBR } : {}),
      ...(d.accountingMonth !== undefined ? { accountingMonth: d.accountingMonth } : {}),
      ...(d.accountingYear !== undefined ? { accountingYear: d.accountingYear } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { invoicePayment: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, tx.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // If linked to an invoice payment, also reverse the invoice paidAmount
  await prisma.$transaction(async (trx) => {
    if (tx.invoicePayment) {
      const inv = await trx.invoice.findUnique({ where: { id: tx.invoicePayment.invoiceId } });
      if (inv) {
        const newPaid = inv.paidAmount - tx.invoicePayment.amount;
        const newStatus = newPaid <= 0n ? "PENDING" : newPaid >= inv.totalAmount ? "PAID" : "PARTIAL";
        await trx.invoice.update({
          where: { id: inv.id },
          data: { paidAmount: newPaid < 0n ? 0n : newPaid, status: newStatus },
        });
      }
    }
    await trx.transaction.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
