import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { generateInvoiceForContract } from "@/lib/invoice-service";

const bodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(3000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { month, year } = parsed.data;

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  if (c.startDate > endOfMonth) {
    return NextResponse.json({ error: "Kỳ HĐ chưa bắt đầu" }, { status: 400 });
  }
  if (!c.isOpenEnded && c.endDate < startOfMonth) {
    return NextResponse.json({ error: "HĐ đã kết thúc trước kỳ này" }, { status: 400 });
  }

  const result = await generateInvoiceForContract(c.id, month, year, { reactivateCancelled: true });
  if (!result) return NextResponse.json({ error: "Không tạo được HĐ" }, { status: 400 });
  if (!result.created && !result.reactivated) {
    return NextResponse.json(
      { error: "Đã có hoá đơn cho kỳ này", invoiceId: result.invoiceId, code: result.code },
      { status: 409 },
    );
  }
  return NextResponse.json(result);
}
