import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  roomId: z.string().optional().nullable(),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  fee: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, existing.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.overtimeRequest.update({
    where: { id },
    data: {
      roomId: d.roomId === undefined ? undefined : d.roomId || null,
      date: d.date ? new Date(d.date) : undefined,
      startTime: d.startTime,
      endTime: d.endTime,
      fee: d.fee !== undefined ? BigInt(d.fee) : undefined,
      notes: d.notes === undefined ? undefined : d.notes || null,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, existing.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // If linked to an invoice, subtract the fee back from the invoice first.
  if (existing.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: existing.invoiceId } });
    if (inv) {
      const newOt = inv.overtimeFee - existing.fee;
      const newOtClamped = newOt < BigInt(0) ? BigInt(0) : newOt;
      const total =
        inv.rentAmount +
        inv.electricityFee +
        inv.parkingFee +
        newOtClamped +
        inv.serviceFee;
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { overtimeFee: newOtClamped, totalAmount: total },
      });
    }
  }
  await prisma.overtimeRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
