import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const schema = z.object({
  electricityPricePerKwh: z.string(),
  parkingFeePerVehicle: z.string(),
  serviceFeeAmount: z.string(),
  waterPricePerPerson: z.string().optional(),
  overtimeFeePerHour: z.string().optional(),
  autoGenerateInvoiceDay: z.number().int().min(1).max(28),
  defaultDueDay: z.number().int().min(1).max(28),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "settings.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const baseData = {
    electricityPricePerKwh: BigInt(d.electricityPricePerKwh),
    parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle),
    serviceFeeAmount: BigInt(d.serviceFeeAmount),
    waterPricePerPerson: d.waterPricePerPerson ? BigInt(d.waterPricePerPerson) : 0n,
    overtimeFeePerHour: d.overtimeFeePerHour ? BigInt(d.overtimeFeePerHour) : 0n,
    autoGenerateInvoiceDay: d.autoGenerateInvoiceDay,
    defaultDueDay: d.defaultDueDay,
  };
  await prisma.buildingSetting.upsert({
    where: { buildingId: id },
    create: { buildingId: id, ...baseData },
    update: baseData,
  });
  return NextResponse.json({ ok: true });
}
