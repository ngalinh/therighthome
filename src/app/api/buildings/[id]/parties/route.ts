import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const createSchema = z.object({
  kind: z.enum(["THO_SUA_CHUA", "THO_XAY", "DON_VE_SINH", "BAO_VE", "NHA_NUOC", "NCC_KHAC", "OTHER"]),
  name: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const p = await prisma.party.create({ data: parsed.data });
  return NextResponse.json({ id: p.id });
}
