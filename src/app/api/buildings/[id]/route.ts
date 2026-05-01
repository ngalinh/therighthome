import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().min(1).max(300).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "building.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await prisma.building.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // FK relations without cascade — must delete in dependency order:
  //   transactions (FK to invoice via invoiceId; no cascade from building)
  //   invoices     (no cascade from building)
  //   contracts    (no cascade from building/room; cascades contractCustomer + contractYearlyRent)
  // Then building.delete cascades: rooms, customers, setting, permissions, openingBalances.
  await prisma.$transaction(async (tx) => {
    const [rooms, contracts, invoices, transactions] = await Promise.all([
      tx.room.count({ where: { buildingId: id } }),
      tx.contract.count({ where: { buildingId: id } }),
      tx.invoice.count({ where: { buildingId: id } }),
      tx.transaction.count({ where: { buildingId: id } }),
    ]);

    await tx.transaction.deleteMany({ where: { buildingId: id } });
    await tx.invoice.deleteMany({ where: { buildingId: id } });
    await tx.contract.deleteMany({ where: { buildingId: id } });
    await tx.building.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityType: "Building",
        entityId: id,
        before: { name: building.name, address: building.address, type: building.type, rooms, contracts, invoices, transactions } as never,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
