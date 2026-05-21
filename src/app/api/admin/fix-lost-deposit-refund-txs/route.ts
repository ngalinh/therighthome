import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: HĐ TERMINATED_LOST_DEPOSIT không được có khoản "Hoàn tiền cọc" trong sổ quỹ.
// Set showInCashbook=false cho tất cả transaction "Hoàn tiền cọc - HĐ ..." thuộc
// các HĐ đã mất cọc (data cũ tạo ra trước khi có guard logic trong terminate route).
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lostDepositContracts = await prisma.contract.findMany({
    where: { status: "TERMINATED_LOST_DEPOSIT" },
    select: { code: true },
  });

  const codes = lostDepositContracts.map((c) => c.code);
  if (codes.length === 0) return NextResponse.json({ updated: 0 });

  const result = await prisma.transaction.updateMany({
    where: {
      content: { in: codes.map((code) => `Hoàn tiền cọc - HĐ ${code}`) },
      showInCashbook: true,
    },
    data: { showInCashbook: false },
  });

  return NextResponse.json({ updated: result.count, contracts: codes.length });
}
