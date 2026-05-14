import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ONE-TIME endpoint: xoá tất cả hoá đơn trước tháng 5/2026.
// Gọi: POST /api/admin/purge-old-invoices   (chỉ ADMIN)
// Sau khi dùng xong → xoá file này.

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Prisma.InvoiceWhereInput = {
    OR: [
      { year: { lt: 2026 } },
      { year: 2026, month: { lt: 5 } },
    ],
  };

  const total = await prisma.invoice.count({ where });
  if (total === 0) {
    return NextResponse.json({ deleted: 0, message: "Không có hoá đơn nào trước tháng 5/2026." });
  }

  const invoiceIds = await prisma.invoice.findMany({ where, select: { id: true } });
  const ids = invoiceIds.map((i) => i.id);

  await prisma.transaction.updateMany({
    where: { invoiceId: { in: ids } },
    data: { invoiceId: null },
  });

  const result = await prisma.invoice.deleteMany({ where });

  return NextResponse.json({
    deleted: result.count,
    message: `Đã xoá ${result.count} hoá đơn trước tháng 5/2026.`,
  });
}
