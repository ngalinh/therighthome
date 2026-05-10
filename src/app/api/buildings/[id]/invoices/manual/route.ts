import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextInvoiceCode } from "@/lib/codes";

const lineSchema = z.object({
  categoryId: z.string().optional().nullable(),
  content: z.string().min(1),
  amount: z.string(), // BigInt as string
});

const createSchema = z.object({
  contractId: z.string(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineSchema).min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: buildingId } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return NextResponse.json({ error: `Dữ liệu không hợp lệ: ${issues}` }, { status: 400 });
  }
  const d = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: d.contractId },
    select: { id: true, buildingId: true, paymentDay: true },
  });
  if (!contract || contract.buildingId !== buildingId) {
    return NextResponse.json({ error: "Hợp đồng không hợp lệ" }, { status: 400 });
  }

  // Resolve line item categories to detect deposit (Tiền cọc → not in P&L).
  const categoryIds = d.lineItems.map((l) => l.categoryId).filter((x): x is string => !!x);
  const categories = categoryIds.length
    ? await prisma.transactionCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const isDeposit = (name: string | undefined) => !!name && /^\s*tiền\s+cọc\s*$/i.test(name);

  let total = 0n;
  for (const l of d.lineItems) {
    const a = BigInt(l.amount);
    if (a <= 0n) return NextResponse.json({ error: "Số tiền mỗi dòng phải > 0" }, { status: 400 });
    total += a;
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const dueDate = d.dueDate
    ? new Date(d.dueDate)
    : new Date(year, month - 1, Math.min(contract.paymentDay || 5, 28));

  let invoiceId: string | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextInvoiceCode();
    try {
      const inv = await prisma.invoice.create({
        data: {
          contractId: contract.id,
          buildingId,
          code,
          month,
          year,
          dueDate,
          rentAmount: 0n,
          totalAmount: total,
          paidAmount: 0n,
          status: "PENDING",
          isManual: true,
          notes: d.notes,
          lineItems: {
            create: d.lineItems.map((l, idx) => ({
              categoryId: l.categoryId || null,
              content: l.content,
              amount: BigInt(l.amount),
              countInBR: !isDeposit(l.categoryId ? catById.get(l.categoryId) : undefined),
              sortOrder: idx,
            })),
          },
        },
      });
      invoiceId = inv.id;
      break;
    } catch (e) {
      lastErr = e;
      const isUniqueViolation =
        typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
      if (!isUniqueViolation) throw e;
    }
  }
  if (!invoiceId) {
    const msg = lastErr instanceof Error ? lastErr.message : "Không thể cấp mã hoá đơn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ id: invoiceId });
}
