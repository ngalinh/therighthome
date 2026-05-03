import { prisma } from "@/lib/prisma";
import { nextInvoiceCode } from "@/lib/codes";
import { computeInvoice, getEffectiveRent } from "@/lib/invoice-compute";

/**
 * Generate invoices for all ACTIVE contracts that don't yet have an invoice
 * for the given (month, year). Idempotent — calling twice doesn't duplicate.
 *
 * Pulls electricity price + parking fee from BuildingSetting (snapshot at
 * generation time). Picks rent from ContractYearlyRent if exists for the
 * year that the invoice falls in, otherwise uses Contract.monthlyRent.
 */
export async function generateMonthlyInvoices(month: number, year: number, buildingId?: string) {
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      ...(buildingId ? { buildingId } : {}),
      startDate: { lte: new Date(year, month, 0) },
    },
    include: {
      building: { include: { setting: true } },
      yearlyRents: true,
    },
  });

  const created: string[] = [];

  for (const c of contracts) {
    if (!c.isOpenEnded && c.endDate < new Date(year, month - 1, 1)) continue;

    const existing = await prisma.invoice.findUnique({
      where: { contractId_month_year: { contractId: c.id, month, year } },
    });
    if (existing) continue;

    const dueDay = c.building.setting?.defaultDueDay ?? c.paymentDay ?? 5;
    const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));

    // Effective rent: yearly override if exists, else monthlyRent
    const effectiveRent = getEffectiveRent(
      c.startDate,
      c.monthlyRent,
      c.yearlyRents.map((y) => ({ yearIndex: y.yearIndex, rent: y.rent })),
      month,
      year,
    );

    // Snapshot electricity + parking from CURRENT building setting
    const electricityPrice = c.building.setting?.electricityPricePerKwh ?? c.electricityPricePerKwh;
    const parkingFeePerVehicle = c.building.setting?.parkingFeePerVehicle ?? c.parkingFeePerVehicle;

    const compute = computeInvoice({
      rentAmount: effectiveRent,
      vatRate: c.vatRate,
      electricityStart: null,
      electricityEnd: null,
      electricityPricePerKwh: electricityPrice,
      parkingCount: c.parkingCount,
      parkingFeePerVehicle,
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
        rentAmount: effectiveRent,
        vatAmount: compute.vatAmount,
        electricityPricePerKwh: electricityPrice,
        electricityFee: 0n,
        parkingCount: c.parkingCount,
        parkingFeePerVehicle,
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
