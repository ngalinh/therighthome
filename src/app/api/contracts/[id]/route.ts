import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { addMonths } from "@/lib/utils";

const updateSchema = z.object({
  startDate: z.string().optional(),
  termMonths: z.number().int().min(1).max(120).optional(),
  paymentDay: z.number().int().min(1).max(28).optional(),
  monthlyRent: z.string().optional(), // BigInt as string
  vatRate: z.number().min(0).max(1).optional(),
  depositAmount: z.string().optional(),
  parkingCount: z.number().int().min(0).optional(),
  parkingFeePerVehicle: z.string().optional(),
  serviceFeeAmount: z.string().optional(),
  electricityPricePerKwh: z.string().optional(),
  notes: z.string().nullable().optional(),
  yearlyRents: z
    .array(z.object({ yearIndex: z.number().int().min(1).max(20), rent: z.string() }))
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (d.startDate) {
    updateData.startDate = new Date(d.startDate);
    const term = d.termMonths ?? c.termMonths;
    updateData.endDate = addMonths(new Date(d.startDate), term);
    updateData.termMonths = term;
  } else if (d.termMonths !== undefined) {
    updateData.termMonths = d.termMonths;
    updateData.endDate = addMonths(c.startDate, d.termMonths);
  }
  if (d.paymentDay !== undefined) updateData.paymentDay = d.paymentDay;
  if (d.monthlyRent !== undefined) updateData.monthlyRent = BigInt(d.monthlyRent);
  if (d.vatRate !== undefined) updateData.vatRate = d.vatRate;
  if (d.depositAmount !== undefined) updateData.depositAmount = BigInt(d.depositAmount);
  if (d.parkingCount !== undefined) updateData.parkingCount = d.parkingCount;
  if (d.parkingFeePerVehicle !== undefined)
    updateData.parkingFeePerVehicle = BigInt(d.parkingFeePerVehicle);
  if (d.serviceFeeAmount !== undefined) updateData.serviceFeeAmount = BigInt(d.serviceFeeAmount);
  if (d.electricityPricePerKwh !== undefined)
    updateData.electricityPricePerKwh = BigInt(d.electricityPricePerKwh);
  if (d.notes !== undefined) updateData.notes = d.notes;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.contract.update({ where: { id }, data: updateData });
    }
    if (d.yearlyRents) {
      await tx.contractYearlyRent.deleteMany({ where: { contractId: id } });
      if (d.yearlyRents.length > 0) {
        await tx.contractYearlyRent.createMany({
          data: d.yearlyRents.map((y) => ({
            contractId: id,
            yearIndex: y.yearIndex,
            rent: BigInt(y.rent),
          })),
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Contract",
        entityId: id,
        buildingId: c.buildingId,
        after: { ...d } as never,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    // Detach transactions from any invoices of this contract (no cascade).
    const invoiceIds = (
      await tx.invoice.findMany({ where: { contractId: id }, select: { id: true } })
    ).map((i) => i.id);
    if (invoiceIds.length > 0) {
      await tx.transaction.updateMany({
        where: { invoiceId: { in: invoiceIds } },
        data: { invoiceId: null },
      });
      await tx.invoice.deleteMany({ where: { contractId: id } });
    }
    // Free room if this was the only ACTIVE contract for it.
    if (c.status === "ACTIVE") {
      const stillActive = await tx.contract.count({
        where: { roomId: c.roomId, status: "ACTIVE", id: { not: id } },
      });
      if (stillActive === 0) {
        await tx.room.update({ where: { id: c.roomId }, data: { status: "AVAILABLE" } });
      }
    }
    // Cascade ContractCustomer + ContractYearlyRent via schema.
    await tx.contract.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: session.user.id, action: "DELETE", entityType: "Contract",
        entityId: id, buildingId: c.buildingId, before: { code: c.code } as never,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
