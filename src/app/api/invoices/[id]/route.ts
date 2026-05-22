import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { recomputeInvoice } from "@/lib/invoice-service";

const lineItemSchema = z.object({
  categoryId: z.string().nullable().optional(),
  content: z.string().min(1),
  amount: z.string(),
});

const updateSchema = z.object({
  electricityStart: z.number().int().nullable().optional(),
  electricityEnd: z.number().int().nullable().optional(),
  parkingCount: z.number().int().min(0).optional(),
  overtimeFee: z.string().optional(),
  repairFee: z.string().optional(),
  extraParkingFee: z.string().optional(),
  serviceFee: z.string().optional(),
  rentAmount: z.string().optional(),
  parkingFeePerVehicle: z.string().optional(),
  electricityPricePerKwh: z.string().optional(),
  waterPricePerPerson: z.string().optional(),
  waterOccupants: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().optional(),
  // Manual invoice line items — when present on a manual invoice with no
  // payments, replaces the entire breakdown and recomputes totalAmount.
  lineItems: z.array(lineItemSchema).optional(),
  // Reactivate a CANCELLED auto invoice back to PENDING after editing amounts.
  reactivate: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  // Manual invoices: line items replace the full breakdown and recompute
  // totalAmount. Skip the rent/electricity recompute path entirely. Only
  // allow line-item edits before any payment has been recorded.
  if (inv.isManual) {
    if (d.lineItems !== undefined) {
      if (inv.paidAmount !== 0n) {
        return NextResponse.json(
          { error: "Không thể sửa chi tiết khi đã có thanh toán" },
          { status: 400 },
        );
      }
      if (d.lineItems.length === 0) {
        return NextResponse.json({ error: "Phải có ít nhất 1 dòng chi phí" }, { status: 400 });
      }

      // Detect "Tiền cọc" categories so countInBR is correctly set on the new
      // line items — same logic as the create endpoint.
      const categoryIds = d.lineItems
        .map((l) => l.categoryId)
        .filter((x): x is string => !!x);
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
        if (a <= 0n) {
          return NextResponse.json({ error: "Số tiền mỗi dòng phải > 0" }, { status: 400 });
        }
        total += a;
      }

      await prisma.$transaction(async (tx) => {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLineItem.createMany({
          data: d.lineItems!.map((l, idx) => ({
            invoiceId: id,
            categoryId: l.categoryId || null,
            content: l.content,
            amount: BigInt(l.amount),
            countInBR: !isDeposit(l.categoryId ? catById.get(l.categoryId) : undefined),
            sortOrder: idx,
          })),
        });
        await tx.invoice.update({
          where: { id },
          data: { totalAmount: total },
        });
      });
    }
  } else {
    // Bring fee snapshots up-to-date BEFORE recompute so the new total uses
    // the user-visible rates (older invoices may have parkingFeePerVehicle=0
    // even though the building setting has a value now).
    if (d.parkingFeePerVehicle !== undefined || d.electricityPricePerKwh !== undefined) {
      await prisma.invoice.update({
        where: { id },
        data: {
          ...(d.parkingFeePerVehicle !== undefined ? { parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle) } : {}),
          ...(d.electricityPricePerKwh !== undefined ? { electricityPricePerKwh: BigInt(d.electricityPricePerKwh) } : {}),
        },
      });
    }

    await recomputeInvoice(id, {
      electricityStart: d.electricityStart,
      electricityEnd: d.electricityEnd,
      parkingCount: d.parkingCount,
      overtimeFee: d.overtimeFee !== undefined ? BigInt(d.overtimeFee) : undefined,
      repairFee: d.repairFee !== undefined ? BigInt(d.repairFee) : undefined,
      extraParkingFee: d.extraParkingFee !== undefined ? BigInt(d.extraParkingFee) : undefined,
      serviceFee: d.serviceFee !== undefined ? BigInt(d.serviceFee) : undefined,
      rentAmount: d.rentAmount !== undefined ? BigInt(d.rentAmount) : undefined,
      waterPricePerPerson: d.waterPricePerPerson !== undefined ? BigInt(d.waterPricePerPerson) : undefined,
      waterOccupants: d.waterOccupants,
    });
    if (d.reactivate && inv.status === "CANCELLED") {
      await prisma.invoice.update({ where: { id }, data: { status: "PENDING" } });
    }
  }

  if (d.notes !== undefined || d.dueDate) {
    await prisma.invoice.update({
      where: { id },
      data: {
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.dueDate ? { dueDate: new Date(d.dueDate) } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hard = new URL(req.url).searchParams.get("hard") === "1";

  if (hard) {
    // Permanent removal — only allowed for already-cancelled invoices so the
    // user can't accidentally wipe an active HĐ in one click. For auto
    // invoices (isManual=false), keep the CANCELLED row instead so the
    // monthly auto-gen respects the cancellation; users wanting a fresh
    // invoice should use "Tạo hoá đơn" on the contract page (reactivates).
    if (inv.status !== "CANCELLED") {
      return NextResponse.json({ error: "Chỉ có thể xoá HĐ đã huỷ" }, { status: 400 });
    }
    if (!inv.isManual) {
      return NextResponse.json(
        { error: "Không thể xoá vĩnh viễn HĐ tự động. Dùng 'Tạo hoá đơn' trên trang HĐ để kích hoạt lại." },
        { status: 400 },
      );
    }
    await prisma.$transaction(async (tx) => {
      // Cancel should already have wiped the transactions, but we re-run for
      // legacy CANCELLED rows that still have linked tx/payments.
      await tx.transaction.deleteMany({ where: { invoiceId: id } });
      await tx.overtimeRequest.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
      });
      await tx.invoice.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "Invoice",
          entityId: id,
          buildingId: inv.buildingId,
          before: {
            code: inv.code,
            status: inv.status,
            totalAmount: inv.totalAmount.toString(),
          } as never,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  // Cancel: drop every Sổ thu / Sổ quỹ / KQKD entry tied to this invoice.
  // Transaction → InvoicePayment cascades, so deleting the transactions also
  // removes the payment-history rows. Reset paidAmount so the invoice goes
  // back to a clean cancelled state.
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: { status: "CANCELLED", paidAmount: 0n },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CANCEL",
        entityType: "Invoice",
        entityId: id,
        buildingId: inv.buildingId,
        before: {
          code: inv.code,
          status: inv.status,
          paidAmount: inv.paidAmount.toString(),
        } as never,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
