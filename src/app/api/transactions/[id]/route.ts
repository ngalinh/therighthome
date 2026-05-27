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
  partyKind: z.string().min(1).max(40).nullable().optional(),
  customerId: z.string().nullable().optional(),
  partyId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
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
  const updateData = {
    ...(d.date ? { date: new Date(d.date) } : {}),
    ...(d.amount ? { amount: BigInt(d.amount) } : {}),
    ...(d.content !== undefined ? { content: d.content } : {}),
    ...(d.notes !== undefined ? { notes: d.notes } : {}),
    ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
    ...(d.paymentMethodId !== undefined ? { paymentMethodId: d.paymentMethodId } : {}),
    ...(d.partyKind !== undefined ? { partyKind: d.partyKind } : {}),
    ...(d.customerId !== undefined ? { customerId: d.customerId } : {}),
    ...(d.partyId !== undefined ? { partyId: d.partyId } : {}),
    ...(d.roomId !== undefined ? { roomId: d.roomId } : {}),
    ...(d.countInBR !== undefined ? { countInBR: d.countInBR } : {}),
    ...(d.accountingMonth !== undefined ? { accountingMonth: d.accountingMonth } : {}),
    ...(d.accountingYear !== undefined ? { accountingYear: d.accountingYear } : {}),
  };
  await prisma.transaction.update({ where: { id }, data: updateData });

  // If this is a transfer pair, sync date/amount/content/notes to the paired transaction
  if (tx.transferPairId) {
    const pairSync: Record<string, unknown> = {};
    if (d.date) pairSync.date = new Date(d.date);
    if (d.amount) pairSync.amount = BigInt(d.amount);
    if (d.content !== undefined) pairSync.content = d.content;
    if (d.notes !== undefined) pairSync.notes = d.notes;
    if (Object.keys(pairSync).length > 0) {
      await prisma.transaction.update({ where: { id: tx.transferPairId }, data: pairSync });
    }
  }

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
  const pairId = tx.transferPairId;
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
    // Clear transferPairId references before deleting to avoid FK issues
    if (pairId) {
      await trx.transaction.update({ where: { id }, data: { transferPairId: null } });
      await trx.transaction.update({ where: { id: pairId }, data: { transferPairId: null } });
      await trx.transaction.delete({ where: { id: pairId } });
    }
    await trx.transaction.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
