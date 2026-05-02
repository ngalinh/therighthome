import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  fullName: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  licensePlate: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, customer.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await prisma.customer.update({ where: { id }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: "UPDATE", entityType: "Customer",
      entityId: id, buildingId: customer.buildingId, after: parsed.data as never,
    },
  });
  return NextResponse.json({ ok: true });
}

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
