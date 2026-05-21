import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: xóa khoản "Hoàn tiền cọc - HĐ VP-010625" nhập nhầm tháng 5.
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.transaction.deleteMany({
    where: { content: "Hoàn tiền cọc - HĐ VP-010625" },
  });

  return NextResponse.json({ deleted: result.count });
}
