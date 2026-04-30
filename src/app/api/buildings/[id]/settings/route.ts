import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const schema = z.object({
  electricityPricePerKwh: z.string(),
  parkingFeePerVehicle: z.string(),
  serviceFeeType: z.enum(["PER_ROOM", "PER_PERSON"]),
  serviceFeeAmount: z.string(),
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
  await prisma.buildingSetting.upsert({
    where: { buildingId: id },
    create: {
      buildingId: id,
      electricityPricePerKwh: BigInt(d.electricityPricePerKwh),
      parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle),
      serviceFeeType: d.serviceFeeType,
      serviceFeeAmount: BigInt(d.serviceFeeAmount),
      autoGenerateInvoiceDay: d.autoGenerateInvoiceDay,
      defaultDueDay: d.defaultDueDay,
    },
    update: {
      electricityPricePerKwh: BigInt(d.electricityPricePerKwh),
      parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle),
      serviceFeeType: d.serviceFeeType,
      serviceFeeAmount: BigInt(d.serviceFeeAmount),
      autoGenerateInvoiceDay: d.autoGenerateInvoiceDay,
      defaultDueDay: d.defaultDueDay,
    },
  });
  return NextResponse.json({ ok: true });
}
