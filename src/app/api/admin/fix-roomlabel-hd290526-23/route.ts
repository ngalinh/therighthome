import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lines = await prisma.invoiceElectricityLine.findMany({
    where: { invoice: { code: "HD-290526-23" }, roomLabel: { startsWith: "PP" } },
  });

  const results = [];
  for (const line of lines) {
    const newLabel = line.roomLabel.slice(1); // bỏ chữ P đầu: "PP301" → "P301"
    await prisma.invoiceElectricityLine.update({
      where: { id: line.id },
      data: { roomLabel: newLabel },
    });
    results.push({ old: line.roomLabel, new: newLabel });
  }

  return NextResponse.json({ updated: results.length, results });
}
