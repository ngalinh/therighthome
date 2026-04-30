import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderInvoiceEmail } from "@/lib/invoice-template";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contract: { include: { customers: { include: { customer: true } } } },
      building: true,
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.send"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "SMTP chưa được cấu hình" }, { status: 400 });
  }

  const primary = inv.contract.customers.find((c) => c.isPrimary)?.customer;
  if (!primary?.email) {
    return NextResponse.json({ error: "Khách thuê chưa có email" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: inv.contract.roomId } });
  const customerName = primary.fullName || primary.companyName || "Khách thuê";

  const html = renderInvoiceEmail({
    buildingName: inv.building.name,
    buildingAddress: inv.building.address,
    customerName,
    roomNumber: room?.number ?? "—",
    invoiceCode: inv.code,
    month: inv.month,
    year: inv.year,
    dueDate: inv.dueDate,
    rentAmount: inv.rentAmount,
    vatAmount: inv.vatAmount,
    electricityStart: inv.electricityStart,
    electricityEnd: inv.electricityEnd,
    electricityFee: inv.electricityFee,
    parkingCount: inv.parkingCount,
    parkingFee: inv.parkingFee,
    overtimeFee: inv.overtimeFee,
    serviceFee: inv.serviceFee,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    notes: inv.notes,
  });

  await sendEmail({
    to: primary.email,
    subject: `Hoá đơn ${String(inv.month).padStart(2, "0")}/${inv.year} — Phòng ${room?.number ?? ""} — ${inv.building.name}`,
    html,
  });

  await prisma.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: "SEND", entityType: "Invoice",
      entityId: id, buildingId: inv.buildingId,
    },
  });
  return NextResponse.json({ ok: true });
}
