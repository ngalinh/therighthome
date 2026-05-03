import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const addSchema = z.object({
  // Either pick an existing customer …
  customerId: z.string().optional(),
  // … or create a new one inline.
  type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  fullName: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  licensePlate: z.string().optional(),
  companyName: z.string().optional(),
  taxNumber: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { customers: true, building: { select: { type: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, contract.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  let customerId = d.customerId;
  if (!customerId) {
    if (!d.type) return NextResponse.json({ error: "Cần type" }, { status: 400 });
    if (d.type === "INDIVIDUAL" && !d.fullName) return NextResponse.json({ error: "Cá nhân cần fullName" }, { status: 400 });
    if (d.type === "COMPANY" && !d.companyName) return NextResponse.json({ error: "Công ty cần companyName" }, { status: 400 });
    const created = await prisma.customer.create({
      data: {
        buildingId: contract.buildingId,
        type: d.type,
        fullName: d.fullName,
        idNumber: d.idNumber,
        phone: d.phone,
        email: d.email,
        licensePlate: d.licensePlate,
        companyName: d.companyName,
        taxNumber: d.taxNumber,
      },
    });
    customerId = created.id;
  }

  // Avoid duplicate (contractId, customerId).
  const existing = contract.customers.find((c) => c.customerId === customerId);
  if (existing) return NextResponse.json({ ok: true, id: existing.id });

  const nextIdx = contract.customers.reduce((max, c) => Math.max(max, c.orderIdx), -1) + 1;
  const cc = await prisma.contractCustomer.create({
    data: {
      contractId: id,
      customerId,
      isPrimary: contract.customers.length === 0,
      orderIdx: nextIdx,
    },
  });
  return NextResponse.json({ ok: true, id: cc.id });
}
