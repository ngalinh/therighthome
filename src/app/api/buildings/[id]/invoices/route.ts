import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { generateMonthlyInvoices } from "@/lib/invoice-service";

const generateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, id, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const codes = await generateMonthlyInvoices(parsed.data.month, parsed.data.year, id);
  return NextResponse.json({ created: codes.length, codes });
}
