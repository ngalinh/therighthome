import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const newC = await prisma.contract.findFirst({ where: { code: "CHDV-180526" } });
  if (!newC) return NextResponse.json({ error: "CHDV-180526 not found" }, { status: 404 });

  const oldC = await prisma.contract.findFirst({ where: { code: "CHDV-150426" } });
  if (!oldC) return NextResponse.json({ error: "CHDV-150426 not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Detach + delete invoices of new contract
    const invoiceIds = (await tx.invoice.findMany({ where: { contractId: newC.id }, select: { id: true } })).map(i => i.id);
    if (invoiceIds.length > 0) {
      await tx.transaction.updateMany({ where: { invoiceId: { in: invoiceIds } }, data: { invoiceId: null } });
      await tx.invoice.deleteMany({ where: { contractId: newC.id } });
    }
    // Delete deposit-related transactions for new contract
    await tx.transaction.deleteMany({
      where: {
        buildingId: newC.buildingId,
        OR: [
          { content: { startsWith: `Thu thêm cọc chuyển phòng - HĐ ${newC.code}` } },
          { content: { startsWith: `Hoàn bớt cọc chuyển phòng - HĐ ${oldC.code}` } },
        ],
      },
    });
    // Delete new contract (ContractCustomer cascades)
    await tx.contract.delete({ where: { id: newC.id } });
    // Restore old contract
    await tx.contract.update({ where: { id: oldC.id }, data: { status: "ACTIVE", terminatedAt: null } });
    // Restore rooms
    await tx.room.update({ where: { id: oldC.roomId }, data: { status: "OCCUPIED" } });
    await tx.room.update({ where: { id: newC.roomId }, data: { status: "AVAILABLE" } });
  });

  return NextResponse.json({ ok: true, message: "Done: CHDV-150426 → ACTIVE, P104 → OCCUPIED, P102 → AVAILABLE, CHDV-180526 → xoá." });
}
