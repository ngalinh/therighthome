import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  roomId: z.string().optional().nullable(),
  date: z.string().optional(),
  partyKind: z.enum(["CUSTOMER", "THO_SUA_CHUA", "THO_XAY", "DON_VE_SINH", "BAO_VE", "NHA_NUOC", "MOI_GIOI", "TOA_NHA", "NCC_KHAC", "OTHER"]).optional().nullable(),
  partyId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  taskName: z.string().optional(),
  status: z.enum(["PENDING", "DONE"]).optional(),
  cost: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, existing.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.maintenanceTask.update({
    where: { id },
    data: {
      roomId: d.roomId === undefined ? undefined : d.roomId || null,
      date: d.date ? new Date(d.date) : undefined,
      partyKind: d.partyKind === undefined ? undefined : d.partyKind || null,
      partyId: d.partyId === undefined ? undefined : d.partyId || null,
      customerId: d.customerId === undefined ? undefined : d.customerId || null,
      taskName: d.taskName,
      status: d.status,
      cost: d.cost !== undefined ? BigInt(d.cost) : undefined,
      notes: d.notes === undefined ? undefined : d.notes || null,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, existing.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Detach from any expense transaction (don't delete the transaction).
  if (existing.expenseTransactionId) {
    await prisma.maintenanceTask.update({
      where: { id },
      data: { expenseTransactionId: null },
    });
  }
  await prisma.maintenanceTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
