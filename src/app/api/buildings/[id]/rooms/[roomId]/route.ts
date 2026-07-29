import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const updateSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  info: z.string().max(5000).nullable().optional(),
  expectedRent: z.string().nullable().optional(),
  vacancyNotes: z.string().max(2000).nullable().optional(),
  status: z.enum(["AVAILABLE", "MAINTENANCE"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; roomId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, roomId } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "building.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: {
    number?: string;
    info?: string | null;
    expectedRent?: bigint | null;
    vacancyNotes?: string | null;
    status?: "AVAILABLE" | "MAINTENANCE";
  } = {};
  if (parsed.data.number !== undefined) data.number = parsed.data.number;
  if (parsed.data.info !== undefined) data.info = parsed.data.info;
  if (parsed.data.vacancyNotes !== undefined) data.vacancyNotes = parsed.data.vacancyNotes;
  if (parsed.data.expectedRent !== undefined) {
    data.expectedRent = parsed.data.expectedRent === null || parsed.data.expectedRent === ""
      ? null
      : BigInt(parsed.data.expectedRent);
  }
  if (parsed.data.status !== undefined) {
    const activeContract = await prisma.contract.count({ where: { roomId, status: "ACTIVE" } });
    if (activeContract > 0) {
      return NextResponse.json({ error: "Phòng đang có hợp đồng, không thể đổi trạng thái" }, { status: 400 });
    }
    data.status = parsed.data.status;
  }

  try {
    await prisma.room.update({ where: { id: roomId }, data });
  } catch (e) {
    const isUnique = typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
    if (isUnique) return NextResponse.json({ error: "Số phòng đã tồn tại" }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; roomId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, roomId } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "building.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const occupied = await prisma.contract.count({ where: { roomId, status: "ACTIVE" } });
  if (occupied > 0) {
    return NextResponse.json({ error: "Phòng đang có hợp đồng, không thể xoá" }, { status: 400 });
  }
  await prisma.room.delete({ where: { id: roomId } });
  return NextResponse.json({ ok: true });
}
