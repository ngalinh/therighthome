import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const upsertSchema = z.object({
  kind: z.enum(["CUSTOMER_REVENUE", "PARTY_DEBT", "CASHBOOK"]),
  customerId: z.string().nullable().optional(),
  partyId: z.string().nullable().optional(),
  paymentMethodLabel: z.string().nullable().optional(),
  amount: z.string(),
  asOfMonth: z.number().int().min(1).max(12),
  asOfYear: z.number().int().min(2020).max(2100),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  // Find existing
  const existing = await prisma.openingBalance.findFirst({
    where: {
      buildingId: id,
      kind: d.kind,
      customerId: d.customerId ?? null,
      partyId: d.partyId ?? null,
      paymentMethodLabel: d.paymentMethodLabel ?? null,
      asOfMonth: d.asOfMonth,
      asOfYear: d.asOfYear,
    },
  });

  const data = {
    buildingId: id,
    kind: d.kind,
    customerId: d.customerId ?? null,
    partyId: d.partyId ?? null,
    paymentMethodLabel: d.paymentMethodLabel ?? null,
    amount: BigInt(d.amount),
    asOfMonth: d.asOfMonth,
    asOfYear: d.asOfYear,
  };

  if (existing) {
    await prisma.openingBalance.update({ where: { id: existing.id }, data });
  } else {
    await prisma.openingBalance.create({ data });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const obId = url.searchParams.get("obId");
  if (!obId) return NextResponse.json({ error: "Missing obId" }, { status: 400 });
  await prisma.openingBalance.delete({ where: { id: obId } });
  return NextResponse.json({ ok: true });
}
