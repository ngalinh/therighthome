import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Corrective one-off. The earlier fix-overtime-june2026 route re-used a stale
// copy of the June invoice for each moved OvertimeRequest, so instead of
// decrementing the fee three times it overwrote the value once. The June
// invoice HD-290526-08 was therefore under-decremented by (3 - 1) × 297500 =
// 595000 in both overtimeFee and totalAmount. This subtracts that residual.
//
// Idempotent: only applies when the invoice still shows the buggy overtimeFee,
// so re-running does nothing. Dry-run by default; add ?apply=1 to write.
const CODE = "HD-290526-08";
const BUGGY_OVERTIME = 1190000n; // value left by the buggy migration
const CORRECT_OVERTIME = 595000n; // 1487500 - 3 × 297500
const CORRECTION = BUGGY_OVERTIME - CORRECT_OVERTIME; // 595000

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const apply = req.nextUrl.searchParams.get("apply") === "1";

  const inv = await prisma.invoice.findUnique({ where: { code: CODE } });
  if (!inv) return NextResponse.json({ error: `Invoice ${CODE} not found` }, { status: 404 });

  if (inv.overtimeFee !== BUGGY_OVERTIME) {
    return NextResponse.json({
      apply,
      changed: false,
      reason: "overtimeFee is not the buggy value — nothing to correct",
      code: CODE,
      currentOvertime: inv.overtimeFee.toString(),
    });
  }

  const result = {
    apply,
    code: CODE,
    overtime: `${inv.overtimeFee} → ${inv.overtimeFee - CORRECTION}`,
    total: `${inv.totalAmount} → ${inv.totalAmount - CORRECTION}`,
  };

  if (apply) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        overtimeFee: inv.overtimeFee - CORRECTION,
        totalAmount: inv.totalAmount - CORRECTION,
      },
    });
  }

  return NextResponse.json({ ...result, changed: apply });
}
