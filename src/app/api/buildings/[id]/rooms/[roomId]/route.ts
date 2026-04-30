import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

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
