import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const codeSchema = z.string().min(1).max(40).regex(/^[A-Z0-9_]+$/, "Code phải IN HOA, số, gạch dưới");

const schema = z.object({
  code: codeSchema,
  label: z.string().min(1).max(80),
  forRevenue: z.boolean().default(true),
  forExpense: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
  const exists = await prisma.partyKindConfig.findUnique({ where: { code: parsed.data.code } });
  if (exists) return NextResponse.json({ error: "Code đã tồn tại" }, { status: 400 });
  const created = await prisma.partyKindConfig.create({ data: parsed.data });
  return NextResponse.json({ id: created.id });
}
