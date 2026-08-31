import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  buildingType: z.enum(["CHDV", "VP"]).nullable(),
  name: z.string().min(1),
  isCash: z.boolean().default(false),
  qrCodeUrl: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankBin: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  buildingIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { buildingIds, ...data } = parsed.data;
  const p = await prisma.paymentMethod.create({
    data: {
      ...data,
      buildings: buildingIds && buildingIds.length > 0
        ? { connect: buildingIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  return NextResponse.json({ id: p.id });
}
