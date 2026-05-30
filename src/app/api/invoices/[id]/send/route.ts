import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderInvoiceEmail } from "@/lib/invoice-template";
import { rentPeriodLabel } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          customers: { include: { customer: true } },
        },
      },
      building: true,
      lineItems: {
        include: { category: { select: { name: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.send"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "SMTP chưa được cấu hình" }, { status: 400 });
  }

  const primary = inv.contract.customers.find((c) => c.isPrimary)?.customer
    ?? inv.contract.customers[0]?.customer;
  if (!primary?.email) {
    return NextResponse.json({ error: "Khách thuê chưa có email" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: inv.contract.roomId } });

  // Fetch payment method — same logic as invoice page
  const specific = await prisma.paymentMethod.findFirst({
    where: { isCash: false, buildings: { some: { id: inv.buildingId } } },
    orderBy: { name: "asc" },
  });
  const fallback = specific
    ? null
    : await prisma.paymentMethod.findFirst({
        where: { isCash: false, buildingType: inv.building.type, buildings: { none: {} } },
        orderBy: { name: "asc" },
      });
  const pm = specific ?? fallback;
  const isIndividual = primary.type === "INDIVIDUAL";
  const paymentMethod =
    inv.building.type === "VP" && isIndividual
      ? { bankName: "ACB", bankBin: null, accountHolder: "TRAN THI TU LAN", accountNumber: "22558", qrCodeUrl: null }
      : pm
      ? { bankName: pm.bankName, bankBin: pm.bankBin, accountHolder: pm.accountHolder, accountNumber: pm.accountNumber, qrCodeUrl: pm.qrCodeUrl }
      : null;

  const rentPeriod = rentPeriodLabel(
    inv.contract.paymentDay,
    inv.month,
    inv.year,
    inv.contract.rentPaymentCycleMonths ?? 1,
  );

  const html = renderInvoiceEmail({
    buildingName: inv.building.name,
    buildingAddress: inv.building.address,
    buildingType: inv.building.type as "CHDV" | "VP",
    customerName: primary.fullName || primary.companyName || "Khách thuê",
    customerPhone: primary.phone ?? null,
    roomNumber: room?.number ?? "—",
    invoiceCode: inv.code,
    month: inv.month,
    year: inv.year,
    rentPeriod,
    dueDate: inv.dueDate,
    rentAmount: inv.rentAmount,
    vatAmount: inv.vatAmount,
    electricityStart: inv.electricityStart,
    electricityEnd: inv.electricityEnd,
    electricityFee: inv.electricityFee,
    electricityPricePerKwh: inv.electricityPricePerKwh,
    parkingCount: inv.parkingCount,
    parkingFee: inv.parkingFee,
    overtimeFee: inv.overtimeFee,
    repairFee: inv.repairFee,
    extraParkingFee: inv.extraParkingFee,
    serviceFee: inv.serviceFee,
    waterOccupants: inv.waterOccupants,
    waterPricePerPerson: inv.waterPricePerPerson,
    waterFee: inv.waterFee,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    vatRate: inv.contract.vatRate ?? 0,
    vatApplicableFees: (inv.contract.vatApplicableFees ?? []) as ("electricity" | "parking" | "overtime" | "repair" | "extraParking")[],
    notes: inv.notes,
    isManual: inv.isManual,
    lineItems: inv.lineItems.map((l) => ({
      content: l.content,
      categoryName: l.category?.name ?? null,
      amount: l.amount,
    })),
    paymentMethod,
  });

  try {
    await sendEmail({
      to: primary.email,
      subject: `Hoá đơn ${String(inv.month).padStart(2, "0")}/${inv.year} — Phòng ${room?.number ?? ""} — ${inv.building.name}`,
      html,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoice/send] SMTP error:", msg);
    return NextResponse.json({ error: `Gửi email thất bại: ${msg}` }, { status: 500 });
  }

  await prisma.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: "SEND", entityType: "Invoice",
      entityId: id, buildingId: inv.buildingId,
    },
  });
  return NextResponse.json({ ok: true });
}
