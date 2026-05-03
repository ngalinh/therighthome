import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

// Remove a customer from a contract (does not delete the underlying Customer).
// If the removed entry was the primary, promote the next one in orderIdx.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; ccId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ccId } = await ctx.params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { customers: { orderBy: { orderIdx: "asc" } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, contract.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const target = contract.customers.find((c) => c.id === ccId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.customers.length === 1) {
    return NextResponse.json({ error: "Hợp đồng phải có ít nhất 1 khách" }, { status: 400 });
  }

  await prisma.contractCustomer.delete({ where: { id: ccId } });

  if (target.isPrimary) {
    const next = contract.customers.find((c) => c.id !== ccId);
    if (next) {
      await prisma.contractCustomer.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
