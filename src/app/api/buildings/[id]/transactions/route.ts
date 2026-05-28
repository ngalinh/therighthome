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
  paymentDate: z.string().optional(),
  partyKind: z.string().min(1).max(40).optional(),
  customerId: z.string().optional(),
  partyId: z.string().optional(),
  roomId: z.string().optional(),
  countInBR: z.boolean().default(true),
  accountingMonth: z.number().int().min(1).max(12).optional(),
  accountingYear: z.number().int().min(2020).max(2100).optional(),
  notes: z.string().optional(),
  destinationPaymentMethodId: z.string().optional(),
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

    // Check if the selected category is a transfer category
    let isTransfer = false;
    if (d.categoryId) {
      const cat = await prisma.transactionCategory.findUnique({ where: { id: d.categoryId }, select: { isTransfer: true } });
      isTransfer = cat?.isTransfer ?? false;
    }

    if (isTransfer) {
      // Transfer requires a destination payment method
      if (!d.destinationPaymentMethodId) {
        return NextResponse.json({ error: "Chọn tài khoản nhận" }, { status: 400 });
      }
      // Fetch building type and income-side transfer category
      const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { type: true } });
      const transferIncomeCategory = await prisma.transactionCategory.findFirst({
        where: { name: "Chuyển nguồn", type: "INCOME", buildingType: building!.type, isTransfer: true },
      });
      if (!transferIncomeCategory) {
        return NextResponse.json({ error: "Không tìm thấy danh mục thu Chuyển nguồn" }, { status: 400 });
      }

      const acctMonth = d.accountingMonth ?? date.getMonth() + 1;
      const acctYear = d.accountingYear ?? date.getFullYear();

      let expense: { id: string; code: string } | undefined;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const expenseCode = await nextTransactionCode(buildingId, "EXPENSE");
        const incomeCode = await nextTransactionCode(buildingId, "INCOME");
        try {
          const result = await prisma.$transaction(async (trx) => {
            const exp = await trx.transaction.create({
              data: {
                buildingId,
                code: expenseCode,
                date,
                type: "EXPENSE",
                amount: BigInt(d.amount),
                content: d.content,
                notes: d.notes,
                categoryId: d.categoryId,
                paymentMethodId: d.paymentMethodId,
                countInBR: false,
                accountingMonth: acctMonth,
                accountingYear: acctYear,
                createdById: session.user.id,
              },
            });
            const inc = await trx.transaction.create({
              data: {
                buildingId,
                code: incomeCode,
                date,
                type: "INCOME",
                amount: BigInt(d.amount),
                content: d.content,
                notes: d.notes,
                categoryId: transferIncomeCategory.id,
                paymentMethodId: d.destinationPaymentMethodId,
                countInBR: false,
                accountingMonth: acctMonth,
                accountingYear: acctYear,
                createdById: session.user.id,
                transferPairId: exp.id,
              },
            });
            await trx.transaction.update({
              where: { id: exp.id },
              data: { transferPairId: inc.id },
            });
            return exp;
          });
          expense = result;
          break;
        } catch (e) {
          lastErr = e;
          const isUniqueViolation = typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
          if (!isUniqueViolation) throw e;
        }
      }
      if (!expense) throw lastErr ?? new Error("Không thể cấp mã phiếu chuyển nguồn");
      return NextResponse.json({ id: expense.id, code: expense.code });
    }

    // Race-safe code allocation: nextTransactionCode + create can collide
    // when two requests run in parallel. Retry on Prisma P2002 (unique
    // violation on `code`) up to 5 times — each retry recomputes the next
    // code based on the latest DB state.
    let tx;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await nextTransactionCode(buildingId, d.type);
      try {
        tx = await prisma.transaction.create({
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
            paymentDate: d.paymentDate ? new Date(d.paymentDate) : null,
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
        break;
      } catch (e) {
        lastErr = e;
        const isUniqueViolation = typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
        if (!isUniqueViolation) throw e;
      }
    }
    if (!tx) throw lastErr ?? new Error("Không thể cấp mã phiếu chi");
    return NextResponse.json({ id: tx.id, code: tx.code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[transactions POST] failed:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
