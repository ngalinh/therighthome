import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextTransactionCode } from "@/lib/codes";

const paySchema = z.object({
  paymentMethodId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});

// Creates an EXPENSE transaction for the maintenance task, links it back.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const task = await prisma.maintenanceTask.findUnique({
    where: { id },
    include: { building: { select: { type: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, task.buildingId, "finance.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (task.expenseTransactionId) {
    return NextResponse.json({ error: "Đã tạo phiếu chi cho công việc này" }, { status: 400 });
  }
  if (task.cost <= BigInt(0)) {
    return NextResponse.json({ error: "Chi phí phải lớn hơn 0" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Default category: "Sửa chữa" for the building's type.
  let categoryId = parsed.data.categoryId || undefined;
  if (!categoryId) {
    const cat = await prisma.transactionCategory.findFirst({
      where: { buildingType: task.building.type, name: "Sửa chữa", type: "EXPENSE" },
    });
    categoryId = cat?.id;
  }

  const code = await nextTransactionCode(task.buildingId, "EXPENSE");
  const tx = await prisma.transaction.create({
    data: {
      buildingId: task.buildingId,
      code,
      date: task.date,
      type: "EXPENSE",
      amount: task.cost,
      content: task.taskName,
      notes: task.notes,
      categoryId,
      paymentMethodId: parsed.data.paymentMethodId || undefined,
      partyKind: task.partyKind || undefined,
      partyId: task.partyId || undefined,
      customerId: task.customerId || undefined,
      countInBR: true,
      accountingMonth: task.date.getMonth() + 1,
      accountingYear: task.date.getFullYear(),
      createdById: session.user.id,
    },
  });
  await prisma.maintenanceTask.update({
    where: { id },
    data: {
      expenseTransactionId: tx.id,
      status: "DONE",
    },
  });
  return NextResponse.json({ id: tx.id, code: tx.code });
}
