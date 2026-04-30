import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
  permissions: z.array(z.object({
    buildingId: z.string(),
    permission: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"]),
  })).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: "Email đã tồn tại" }, { status: 400 });
  const user = await prisma.user.create({
    data: {
      email: d.email.toLowerCase(),
      name: d.name,
      passwordHash: await hashPassword(d.password),
      role: d.role,
      permissions: d.role === "STAFF" ? { create: d.permissions } : undefined,
    },
  });
  return NextResponse.json({ id: user.id });
}
