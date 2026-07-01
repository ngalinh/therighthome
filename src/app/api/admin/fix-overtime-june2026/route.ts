import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off fix: overtime worked in June 2026 was mis-billed onto the June
// invoice (same month as the OT date). It should sit on the July invoice.
// This moves the fee: subtract from the June invoice, add to the July invoice
// of the same contract, and re-point the OvertimeRequest. Totals are adjusted
// by the exact delta so VAT/water and other fees are preserved.
//
// Dry-run by default; add ?apply=1 to write.
const SRC_MONTH = 6;
const SRC_YEAR = 2026;
const DST_MONTH = 7;
const DST_YEAR = 2026;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const apply = req.nextUrl.searchParams.get("apply") === "1";

  const requests = await prisma.overtimeRequest.findMany({
    where: { invoiceId: { not: null } },
    include: { invoice: true },
  });

  const moved: Record<string, unknown>[] = [];
  const skipped: Record<string, unknown>[] = [];

  for (const ot of requests) {
    const inv = ot.invoice;
    if (!inv) continue;
    const otMonth = ot.date.getMonth() + 1;
    const otYear = ot.date.getFullYear();

    // Only touch June-2026 OT currently pinned to its June-2026 invoice.
    if (otMonth !== SRC_MONTH || otYear !== SRC_YEAR) continue;
    if (inv.month !== SRC_MONTH || inv.year !== SRC_YEAR) {
      skipped.push({ id: ot.id, reason: "not on June invoice", invoice: inv.code });
      continue;
    }

    const target = await prisma.invoice.findFirst({
      where: { contractId: inv.contractId, month: DST_MONTH, year: DST_YEAR },
    });
    if (!target) {
      skipped.push({ id: ot.id, reason: "no July invoice for this contract", invoice: inv.code });
      continue;
    }

    // Amount actually removable from the source (mirror delete-route clamp).
    const removed = inv.overtimeFee < ot.fee ? inv.overtimeFee : ot.fee;

    const record = {
      id: ot.id,
      fee: ot.fee.toString(),
      from: inv.code,
      to: target.code,
      fromOvertime: `${inv.overtimeFee} → ${inv.overtimeFee - removed}`,
      toOvertime: `${target.overtimeFee} → ${target.overtimeFee + ot.fee}`,
    };
    moved.push(record);

    if (apply) {
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: inv.id },
          data: {
            overtimeFee: inv.overtimeFee - removed,
            totalAmount: inv.totalAmount - removed,
          },
        }),
        prisma.invoice.update({
          where: { id: target.id },
          data: {
            overtimeFee: target.overtimeFee + ot.fee,
            totalAmount: target.totalAmount + ot.fee,
          },
        }),
        prisma.overtimeRequest.update({
          where: { id: ot.id },
          data: { invoiceId: target.id },
        }),
      ]);
    }
  }

  return NextResponse.json({ apply, movedCount: moved.length, moved, skipped });
}
