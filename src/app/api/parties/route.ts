import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kind: z.enum(["THO_SUA_CHUA", "THO_XAY", "DON_VE_SINH", "BAO_VE", "NHA_NUOC", "NCC_KHAC", "OTHER"]),
  name: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const p = await prisma.party.create({ data: parsed.data });
  return NextResponse.json({ id: p.id });
}
