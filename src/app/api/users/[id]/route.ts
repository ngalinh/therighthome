import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  permissions: z.array(z.object({
    buildingId: z.string(),
    permission: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"]),
  })).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.role !== undefined ? { role: d.role } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
      },
    });
    if (d.permissions) {
      await tx.userBuildingPermission.deleteMany({ where: { userId: id } });
      if (d.permissions.length > 0) {
        await tx.userBuildingPermission.createMany({
          data: d.permissions.map((p) => ({ ...p, userId: id })),
        });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (id === session.user.id) return NextResponse.json({ error: "Không thể xoá chính mình" }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
