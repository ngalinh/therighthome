import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const transferred = await prisma.contract.findMany({
    where: { transferredFromId: { not: null } },
    include: { transferredFrom: { select: { endDate: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  const results = [];
  for (const c of transferred) {
    const correctEnd = c.transferredFrom?.endDate;
    if (!correctEnd) continue;
    if (c.endDate.getTime() === correctEnd.getTime()) {
      results.push({ code: c.code, status: "already_correct" });
      continue;
    }
    await prisma.contract.update({
      where: { id: c.id },
      data: { endDate: correctEnd },
    });
    results.push({ code: c.code, oldEnd: c.endDate, newEnd: correctEnd, status: "fixed" });
  }

  return NextResponse.json({ results });
}
