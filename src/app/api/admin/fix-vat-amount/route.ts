import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      building: { type: "VP" },
      status: { not: "CANCELLED" },
      contract: { vatRate: { gt: 0 } },
    },
    include: {
      contract: { select: { vatRate: true } },
    },
  });

  const results: { code: string; oldVat: string; newVat: string }[] = [];

  for (const inv of invoices) {
    const vatRate = inv.contract.vatRate; // 0..1
    // Correct formula: VAT portion included in rentAmount = rent * rate / (1 + rate)
    const newVatAmount = BigInt(Math.round(Number(inv.rentAmount) * vatRate / (1 + vatRate)));
    if (newVatAmount === inv.vatAmount) continue;

    await prisma.invoice.update({
      where: { id: inv.id },
      data: { vatAmount: newVatAmount },
    });

    results.push({
      code: inv.code,
      oldVat: inv.vatAmount.toString(),
      newVat: newVatAmount.toString(),
    });
  }

  return NextResponse.json({ updated: results.length, results });
}
