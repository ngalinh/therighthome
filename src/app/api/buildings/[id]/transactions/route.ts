import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextTransactionCode } from "@/lib/codes";

const createSchema = z.object({
  date: z.string(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.string(),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  partyKind: z.enum(["CUSTOMER", "THO_SUA_CHUA", "THO_XAY", "DON_VE_SINH", "BAO_VE", "NHA_NUOC", "NCC_KHAC", "OTHER"]).optional(),
  customerId: z.string().optional(),
  partyId: z.string().optional(),
  roomId: z.string().optional(),
  countInBR: z.boolean().default(true),
  accountingMonth: z.number().int().min(1).max(12).optional(),
  accountingYear: z.number().int().min(2020).max(2100).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: buildingId } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: `Dữ liệu không hợp lệ: ${issues}` }, { status: 400 });
    }
    const d = parsed.data;
    const date = new Date(d.date);
    const code = await nextTransactionCode(buildingId, d.type);
    const tx = await prisma.transaction.create({
      data: {
        buildingId,
        code,
        date,
        type: d.type,
        amount: BigInt(d.amount),
        content: d.content,
        notes: d.notes,
        categoryId: d.categoryId,
        paymentMethodId: d.paymentMethodId,
        partyKind: d.partyKind,
        customerId: d.customerId,
        partyId: d.partyId,
        roomId: d.roomId,
        countInBR: d.countInBR,
        accountingMonth: d.accountingMonth ?? date.getMonth() + 1,
        accountingYear: d.accountingYear ?? date.getFullYear(),
        createdById: session.user.id,
      },
    });
    return NextResponse.json({ id: tx.id, code: tx.code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[transactions POST] failed:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
