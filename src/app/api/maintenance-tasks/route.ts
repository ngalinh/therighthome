import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const createSchema = z.object({
  buildingId: z.string().min(1),
  roomId: z.string().optional().nullable(),
  date: z.string().min(1),
  partyKind: z.enum(["CUSTOMER", "THO_SUA_CHUA", "THO_XAY", "DON_VE_SINH", "BAO_VE", "NHA_NUOC", "NCC_KHAC", "OTHER"]).optional().nullable(),
  partyId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  taskName: z.string().min(1),
  status: z.enum(["PENDING", "DONE"]).default("PENDING"),
  cost: z.string().default("0"),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  if (!(await can(session.user.id, session.user.role, d.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const t = await prisma.maintenanceTask.create({
    data: {
      buildingId: d.buildingId,
      roomId: d.roomId || null,
      date: new Date(d.date),
      partyKind: d.partyKind || null,
      partyId: d.partyId || null,
      customerId: d.customerId || null,
      taskName: d.taskName,
      status: d.status,
      cost: BigInt(d.cost || "0"),
      notes: d.notes || null,
      createdById: session.user.id,
    },
  });
  return NextResponse.json({ id: t.id });
}
