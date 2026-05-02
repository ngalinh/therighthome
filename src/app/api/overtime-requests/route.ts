import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const createSchema = z.object({
  buildingId: z.string().min(1),
  roomId: z.string().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  fee: z.string().default("0"),
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
  const r = await prisma.overtimeRequest.create({
    data: {
      buildingId: d.buildingId,
      roomId: d.roomId || null,
      date: new Date(d.date),
      startTime: d.startTime,
      endTime: d.endTime,
      fee: BigInt(d.fee || "0"),
      notes: d.notes || null,
      createdById: session.user.id,
    },
  });
  return NextResponse.json({ id: r.id });
}
