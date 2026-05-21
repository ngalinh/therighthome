import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: xóa khoản "Hoàn tiền cọc - HĐ VP-200524" sai tài khoản TTTL.
// Giữ lại khoản đúng ở tài khoản NL.
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tttlPM = await prisma.paymentMethod.findFirst({
    where: { name: "TTTL" },
    select: { id: true },
  });
  if (!tttlPM) return NextResponse.json({ error: "TTTL payment method not found" }, { status: 404 });

  const result = await prisma.transaction.deleteMany({
    where: {
      content: "Hoàn tiền cọc - HĐ VP-200524",
      paymentMethodId: tttlPM.id,
    },
  });

  return NextResponse.json({ deleted: result.count });
}
