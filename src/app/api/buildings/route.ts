import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(300),
  type: z.enum(["CHDV", "VP"]),
  roomCount: z.number().int().min(0).max(500).default(0),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { name, address, type, roomCount } = parsed.data;

  const building = await prisma.building.create({
    data: {
      name,
      address,
      type,
      setting: { create: {} },
      rooms: { create: Array.from({ length: roomCount }, (_, i) => ({ number: String(i + 1) })) },
      permissions: {
        create: { userId: session.user.id, permission: "OWNER" },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Building",
      entityId: building.id,
      buildingId: building.id,
      after: { name, address, type },
    },
  });

  return NextResponse.json({ id: building.id });
}
