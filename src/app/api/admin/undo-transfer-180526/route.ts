import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time route: undo room transfer for CHDV-180526
// - Delete new contract CHDV-180526 (and its customers)
// - Restore CHDV-150426 → ACTIVE, clear terminatedAt
// - Restore P104 → OCCUPIED, P102 → AVAILABLE
export async function GET() {
  const newContract = await prisma.contract.findFirst({
    where: { code: "CHDV-180526" },
    include: { room: true },
  });
  if (!newContract) return NextResponse.json({ error: "CHDV-180526 not found" }, { status: 404 });

  const oldContract = await prisma.contract.findFirst({
    where: { code: "CHDV-150426" },
    include: { room: true },
  });
  if (!oldContract) return NextResponse.json({ error: "CHDV-150426 not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Delete new contract customers + contract
    await tx.contractCustomer.deleteMany({ where: { contractId: newContract.id } });
    await tx.contract.delete({ where: { id: newContract.id } });

    // Restore old contract
    await tx.contract.update({
      where: { id: oldContract.id },
      data: { status: "ACTIVE", terminatedAt: null },
    });

    // Restore rooms
    await tx.room.update({ where: { id: oldContract.roomId }, data: { status: "OCCUPIED" } }); // P104
    await tx.room.update({ where: { id: newContract.roomId }, data: { status: "AVAILABLE" } }); // P102
  });

  return NextResponse.json({ ok: true, message: "Đã hoàn tác chuyển phòng. CHDV-150426 → ACTIVE, P104 → OCCUPIED, P102 → AVAILABLE, CHDV-180526 → đã xoá." });
}
