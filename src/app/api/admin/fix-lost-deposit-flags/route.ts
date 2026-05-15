import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fix transactions created by terminate route before showInCashbook field existed.
  // They were set countInBR=false as a workaround — now correct to countInBR=true + showInCashbook=false.
  const result = await prisma.transaction.updateMany({
    where: {
      content: { startsWith: "Tiền cọc mất - HĐ" },
      countInBR: false,
    },
    data: { countInBR: true, showInCashbook: false },
  });

  return NextResponse.json({ updated: result.count });
}
