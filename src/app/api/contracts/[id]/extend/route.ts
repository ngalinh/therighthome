import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { addMonths, monthsBetween } from "@/lib/utils";

// "Gia hạn HĐ": same contract code; either turn it open-ended (vô thời hạn)
// or push the endDate forward by N months from a chosen restart date, with an
// optional rent change.
const schema = z.object({
  isOpenEnded: z.boolean().optional(),
  startDate: z.string().optional(),       // when the extension begins (default = current endDate)
  extensionMonths: z.number().int().min(1).optional(),
  monthlyRent: z.string().optional(),     // optional: new rent (after VAT) starting from extension
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  // Open-ended: just flip the flag, optionally bump rent. Status stays ACTIVE.
  if (d.isOpenEnded) {
    await prisma.contract.update({
      where: { id },
      data: {
        isOpenEnded: true,
        status: "ACTIVE",
        ...(d.monthlyRent ? { monthlyRent: BigInt(d.monthlyRent) } : {}),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXTEND",
        entityType: "Contract",
        entityId: id,
        buildingId: c.buildingId,
        after: { isOpenEnded: true, monthlyRent: d.monthlyRent },
      },
    });
    return NextResponse.json({ ok: true, isOpenEnded: true });
  }

  // Fixed-term extension.
  if (!d.extensionMonths || d.extensionMonths < 1) {
    return NextResponse.json({ error: "Số tháng gia hạn phải > 0" }, { status: 400 });
  }
  const restart = d.startDate ? new Date(d.startDate) : c.endDate;
  const newEnd = addMonths(restart, d.extensionMonths);
  // termMonths is the total span from original startDate to the new endDate.
  const totalMonths = monthsBetween(c.startDate, newEnd);

  await prisma.contract.update({
    where: { id },
    data: {
      endDate: newEnd,
      termMonths: totalMonths > 0 ? totalMonths : c.termMonths,
      isOpenEnded: false,
      status: "ACTIVE",
      ...(d.monthlyRent ? { monthlyRent: BigInt(d.monthlyRent) } : {}),
    },
  });
  // Mark room occupied in case it had been freed by an earlier expiry.
  await prisma.room.update({ where: { id: c.roomId }, data: { status: "OCCUPIED" } }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXTEND",
      entityType: "Contract",
      entityId: id,
      buildingId: c.buildingId,
      after: {
        restart: restart.toISOString(),
        extensionMonths: d.extensionMonths,
        newEnd: newEnd.toISOString(),
        monthlyRent: d.monthlyRent,
      },
    },
  });

  return NextResponse.json({ ok: true, endDate: newEnd.toISOString() });
}
