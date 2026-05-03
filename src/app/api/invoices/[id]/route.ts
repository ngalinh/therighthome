import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { recomputeInvoice } from "@/lib/invoice-service";

const updateSchema = z.object({
  electricityStart: z.number().int().nullable().optional(),
  electricityEnd: z.number().int().nullable().optional(),
  parkingCount: z.number().int().min(0).optional(),
  overtimeFee: z.string().optional(),
  serviceFee: z.string().optional(),
  rentAmount: z.string().optional(),
  parkingFeePerVehicle: z.string().optional(),
  electricityPricePerKwh: z.string().optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  // Bring fee snapshots up-to-date BEFORE recompute so the new total uses
  // the user-visible rates (older invoices may have parkingFeePerVehicle=0
  // even though the building setting has a value now).
  if (d.parkingFeePerVehicle !== undefined || d.electricityPricePerKwh !== undefined) {
    await prisma.invoice.update({
      where: { id },
      data: {
        ...(d.parkingFeePerVehicle !== undefined ? { parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle) } : {}),
        ...(d.electricityPricePerKwh !== undefined ? { electricityPricePerKwh: BigInt(d.electricityPricePerKwh) } : {}),
      },
    });
  }

  await recomputeInvoice(id, {
    electricityStart: d.electricityStart,
    electricityEnd: d.electricityEnd,
    parkingCount: d.parkingCount,
    overtimeFee: d.overtimeFee !== undefined ? BigInt(d.overtimeFee) : undefined,
    serviceFee: d.serviceFee !== undefined ? BigInt(d.serviceFee) : undefined,
    rentAmount: d.rentAmount !== undefined ? BigInt(d.rentAmount) : undefined,
  });

  if (d.notes !== undefined || d.dueDate) {
    await prisma.invoice.update({
      where: { id },
      data: {
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.dueDate ? { dueDate: new Date(d.dueDate) } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
