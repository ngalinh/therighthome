import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: backfill roomId trên các transaction thanh toán hoá đơn tạo trước PR #210.
// Chạy 1 lần duy nhất rồi có thể xoá endpoint này.
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { invoiceId: { not: null }, roomId: null },
    select: { id: true, invoiceId: true },
  });

  if (transactions.length === 0) return NextResponse.json({ updated: 0 });

  const invoiceIds = [...new Set(transactions.map((t) => t.invoiceId!))];
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, contract: { select: { roomId: true } } },
  });
  const roomByInvoice = new Map(invoices.map((i) => [i.id, i.contract.roomId]));

  let updated = 0;
  for (const txn of transactions) {
    const roomId = roomByInvoice.get(txn.invoiceId!);
    if (!roomId) continue;
    await prisma.transaction.update({ where: { id: txn.id }, data: { roomId } });
    updated++;
  }

  return NextResponse.json({ updated, total: transactions.length });
}
