import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  buildingType: z.enum(["CHDV", "VP"]).nullable(),
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const c = await prisma.transactionCategory.create({ data: parsed.data });
  return NextResponse.json({ id: c.id });
}
