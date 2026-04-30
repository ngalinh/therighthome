import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const createSchema = z.object({
  numbers: z.array(z.string().min(1).max(20)).min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "building.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const created = await prisma.$transaction(
    parsed.data.numbers.map((n) =>
      prisma.room.upsert({
        where: { buildingId_number: { buildingId: id, number: n } },
        create: { buildingId: id, number: n },
        update: {},
      }),
    ),
  );
  return NextResponse.json({ count: created.length });
}
