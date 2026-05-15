import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.transaction.updateMany({
    where: {
      content: { contains: "Tiền cọc mất - HĐ CHDV-011225" },
      countInBR: true,
    },
    data: { countInBR: false },
  });

  return NextResponse.json({ updated: result.count });
}
