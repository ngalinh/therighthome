import { prisma } from "@/lib/prisma";
import { nextInvoiceCode } from "@/lib/codes";
import { computeInvoice } from "@/lib/invoice-compute";

/**
 * Generate invoices for all ACTIVE contracts that don't yet have an invoice
 * for the given (month, year). Idempotent — calling twice doesn't duplicate.
 */
export async function generateMonthlyInvoices(month: number, year: number, buildingId?: string) {
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      ...(buildingId ? { buildingId } : {}),
      // Skip contracts that haven't started or have ended
      startDate: { lte: new Date(year, month, 0) }, // last day of (month-1)
    },
    include: { building: { include: { setting: true } } },
  });

  const created: string[] = [];

  for (const c of contracts) {
    if (c.endDate < new Date(year, month - 1, 1)) continue;

    const existing = await prisma.invoice.findUnique({
      where: { contractId_month_year: { contractId: c.id, month, year } },
    });
    if (existing) continue;

    const dueDay = c.building.setting?.defaultDueDay ?? c.paymentDay ?? 5;
    const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));

    const compute = computeInvoice({
      rentAmount: c.monthlyRent,
      vatRate: c.vatRate,
      electricityStart: null,
      electricityEnd: null,
      electricityPricePerKwh: c.electricityPricePerKwh,
      parkingCount: c.parkingCount,
      parkingFeePerVehicle: c.parkingFeePerVehicle,
      overtimeFee: 0n,
      serviceFee: c.serviceFeeAmount,
    });

    const code = await nextInvoiceCode(c.buildingId, month, year);
    await prisma.invoice.create({
      data: {
        contractId: c.id,
        buildingId: c.buildingId,
        code,
        month,
        year,
        dueDate,
        rentAmount: c.monthlyRent,
        vatAmount: compute.vatAmount,
        electricityPricePerKwh: c.electricityPricePerKwh,
        electricityFee: 0n,
        parkingCount: c.parkingCount,
        parkingFeePerVehicle: c.parkingFeePerVehicle,
        parkingFee: compute.parkingFee,
        overtimeFee: 0n,
        serviceFee: c.serviceFeeAmount,
        totalAmount: compute.totalAmount,
        paidAmount: 0n,
        status: "PENDING",
      },
    });
    created.push(code);
  }

  return created;
}

/**
 * Auto-mark invoices as OVERDUE if past dueDate and not fully paid.
 */
export async function markOverdueInvoices() {
  const now = new Date();
  const updated = await prisma.invoice.updateMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });
  return updated.count;
}

/**
 * Recompute totals for an invoice given new values (e.g., updated electricity).
 */
export async function recomputeInvoice(invoiceId: string, partial: {
  electricityStart?: number | null;
  electricityEnd?: number | null;
  parkingCount?: number;
  overtimeFee?: bigint;
  serviceFee?: bigint;
  rentAmount?: bigint;
}) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { contract: true } });
  if (!inv) throw new Error("Invoice not found");

  const compute = computeInvoice({
    rentAmount: partial.rentAmount ?? inv.rentAmount,
    vatRate: inv.contract.vatRate,
    electricityStart: partial.electricityStart ?? inv.electricityStart,
    electricityEnd: partial.electricityEnd ?? inv.electricityEnd,
    electricityPricePerKwh: inv.electricityPricePerKwh,
    parkingCount: partial.parkingCount ?? inv.parkingCount,
    parkingFeePerVehicle: inv.parkingFeePerVehicle,
    overtimeFee: partial.overtimeFee ?? inv.overtimeFee,
    serviceFee: partial.serviceFee ?? inv.serviceFee,
  });

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      rentAmount: partial.rentAmount ?? inv.rentAmount,
      vatAmount: compute.vatAmount,
      electricityStart: partial.electricityStart ?? inv.electricityStart,
      electricityEnd: partial.electricityEnd ?? inv.electricityEnd,
      electricityFee: compute.electricityFee,
      parkingCount: partial.parkingCount ?? inv.parkingCount,
      parkingFee: compute.parkingFee,
      overtimeFee: partial.overtimeFee ?? inv.overtimeFee,
      serviceFee: partial.serviceFee ?? inv.serviceFee,
      totalAmount: compute.totalAmount,
    },
  });
}
