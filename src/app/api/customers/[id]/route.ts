import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { contractCustomers: { include: { contract: true } } },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, customer.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If customer is primary on an ACTIVE contract and there's a secondary, promote secondary.
  await prisma.$transaction(async (tx) => {
    for (const cc of customer.contractCustomers) {
      if (cc.isPrimary && cc.contract.status === "ACTIVE") {
        const next = await tx.contractCustomer.findFirst({
          where: { contractId: cc.contractId, customerId: { not: id } },
          orderBy: { orderIdx: "asc" },
        });
        if (next) {
          await tx.contractCustomer.update({ where: { id: next.id }, data: { isPrimary: true, orderIdx: 0 } });
        }
      }
    }
    await tx.customer.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
