import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: force the rent-period label on invoice HD-300626-53 to show the
// calendar month (01/07/26-31/07/26) instead of the paymentDay-anchored range.
// Only this single invoice is touched.
const CODE = "HD-300626-53";
const RENT_PERIOD = "01/07/26-31/07/26";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inv = await prisma.invoice.findUnique({ where: { code: CODE } });
  if (!inv) {
    return NextResponse.json({ error: `Invoice ${CODE} not found` }, { status: 404 });
  }

  await prisma.invoice.update({
    where: { id: inv.id },
    data: { rentPeriodOverride: RENT_PERIOD },
  });

  return NextResponse.json({
    code: CODE,
    old: inv.rentPeriodOverride,
    new: RENT_PERIOD,
  });
}
