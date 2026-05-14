import { prisma } from "@/lib/prisma";
import { nextInvoiceCode } from "@/lib/codes";
import { computeInvoice, getEffectiveRent, type VatFeeKey } from "@/lib/invoice-compute";

/**
 * Generate invoices for all ACTIVE contracts that don't yet have an invoice
 * for the given (month, year). Idempotent — calling twice doesn't duplicate,
 * and CANCELLED auto invoices are intentionally NOT regenerated (the user
 * explicitly chose to cancel them; use the "Tạo hoá đơn" button on the
 * contract page to reactivate).
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
    select: { id: true, isOpenEnded: true, endDate: true },
  });

  const created: string[] = [];
  for (const c of contracts) {
    if (!c.isOpenEnded && c.endDate < new Date(year, month - 1, 1)) continue;
    const result = await generateInvoiceForContract(c.id, month, year);
    if (result?.created) created.push(result.code);
  }
  return created;
}

/**
 * Generate (or reactivate) an invoice for a single contract + period.
 *
 * Behavior matrix:
 *   - No existing non-manual invoice → create fresh, return { created: true }
 *   - Existing non-manual CANCELLED invoice:
 *       · reactivateCancelled=true  → recompute + status PENDING, return { reactivated: true }
 *       · reactivateCancelled=false → skip, return null (auto-gen path)
 *   - Existing non-manual non-CANCELLED invoice → skip, return null (idempotent)
 */
export async function generateInvoiceForContract(
  contractId: string,
  month: number,
  year: number,
  opts: { reactivateCancelled?: boolean } = {},
): Promise<{ invoiceId: string; code: string; created: boolean; reactivated: boolean } | null> {
  const c = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      building: { include: { setting: true } },
      yearlyRents: true,
      _count: { select: { customers: true } },
    },
  });
  if (!c) return null;

  const existing = await prisma.invoice.findFirst({
    where: { contractId: c.id, month, year, isManual: false },
  });

  if (existing && existing.status !== "CANCELLED") {
    // Active invoice already exists — never overwrite.
    return { invoiceId: existing.id, code: existing.code, created: false, reactivated: false };
  }
  if (existing && existing.status === "CANCELLED" && !opts.reactivateCancelled) {
    // Auto-gen path: respect the cancellation, do nothing.
    return null;
  }

  // Prefer the contract's own paymentDay over the building default; the user
  // expects "Ngày thanh toán hàng tháng" set on each HĐ to apply.
  const dueDay = c.paymentDay || c.building.setting?.defaultDueDay || 5;
  const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));

  const effectiveRent = getEffectiveRent(
    c.startDate,
    c.monthlyRent,
    c.yearlyRents.map((y) => ({ yearIndex: y.yearIndex, rent: y.rent })),
    month,
    year,
  );

  const electricityPrice = c.building.setting?.electricityPricePerKwh ?? c.electricityPricePerKwh;
  const parkingFeePerVehicle = c.building.setting?.parkingFeePerVehicle ?? c.parkingFeePerVehicle;
  const waterPricePerPerson =
    c.waterPricePerPerson > 0n
      ? c.waterPricePerPerson
      : (c.building.setting?.waterPricePerPerson ?? 0n);
  const waterOccupants = c._count.customers;

  // Carry electricityEnd from the previous month's invoice so the new
  // invoice's "số điện đầu kỳ" is pre-filled with last month's "cuối kỳ".
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = await prisma.invoice.findFirst({
    where: { contractId: c.id, month: prevMonth, year: prevYear, isManual: false },
    select: { electricityEnd: true, electricityEndPhoto: true },
  });
  const electricityStart = prev?.electricityEnd ?? null;
  const electricityStartPhoto = prev?.electricityEndPhoto ?? null;

  const compute = computeInvoice({
    rentAmount: effectiveRent,
    vatRate: c.vatRate,
    vatApplicableFees: c.vatApplicableFees as VatFeeKey[],
    electricityStart,
    electricityEnd: null,
    electricityPricePerKwh: electricityPrice,
    parkingCount: c.parkingCount,
    parkingFeePerVehicle,
    overtimeFee: 0n,
    repairFee: 0n,
    extraParkingFee: 0n,
    serviceFee: c.serviceFeeAmount,
    waterPricePerPerson,
    waterOccupants,
  });

  if (existing && existing.status === "CANCELLED") {
    // Reactivate: keep code + id, reset payment state, snapshot fresh fees.
    await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        dueDate,
        rentAmount: effectiveRent,
        vatAmount: compute.vatAmount,
        electricityStart,
        electricityStartPhoto,
        electricityEnd: null,
        electricityEndPhoto: null,
        electricityPricePerKwh: electricityPrice,
        electricityFee: 0n,
        parkingCount: c.parkingCount,
        parkingFeePerVehicle,
        parkingFee: compute.parkingFee,
        overtimeFee: 0n,
        repairFee: 0n,
        extraParkingFee: 0n,
        serviceFee: c.serviceFeeAmount,
        waterPricePerPerson,
        waterOccupants,
        waterFee: compute.waterFee,
        totalAmount: compute.totalAmount,
        paidAmount: 0n,
        status: "PENDING",
      },
    });
    return { invoiceId: existing.id, code: existing.code, created: false, reactivated: true };
  }

  const code = await nextInvoiceCode();
  const inv = await prisma.invoice.create({
    data: {
      contractId: c.id,
      buildingId: c.buildingId,
      code,
      month,
      year,
      dueDate,
      rentAmount: effectiveRent,
      vatAmount: compute.vatAmount,
      electricityStart,
      electricityStartPhoto,
      electricityPricePerKwh: electricityPrice,
      electricityFee: 0n,
      parkingCount: c.parkingCount,
      parkingFeePerVehicle,
      parkingFee: compute.parkingFee,
      overtimeFee: 0n,
      repairFee: 0n,
      extraParkingFee: 0n,
      serviceFee: c.serviceFeeAmount,
      waterPricePerPerson,
      waterOccupants,
      waterFee: compute.waterFee,
      totalAmount: compute.totalAmount,
      paidAmount: 0n,
      status: "PENDING",
    },
    select: { id: true, code: true },
  });
  return { invoiceId: inv.id, code: inv.code, created: true, reactivated: false };
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
  repairFee?: bigint;
  extraParkingFee?: bigint;
  serviceFee?: bigint;
  rentAmount?: bigint;
  waterPricePerPerson?: bigint;
  waterOccupants?: number;
}) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { contract: true } });
  if (!inv) throw new Error("Invoice not found");

  const waterPricePerPerson = partial.waterPricePerPerson ?? inv.waterPricePerPerson;
  const waterOccupants = partial.waterOccupants ?? inv.waterOccupants;
  const overtimeFee = partial.overtimeFee ?? inv.overtimeFee;
  const repairFee = partial.repairFee ?? inv.repairFee;
  const extraParkingFee = partial.extraParkingFee ?? inv.extraParkingFee;

  const compute = computeInvoice({
    rentAmount: partial.rentAmount ?? inv.rentAmount,
    vatRate: inv.contract.vatRate,
    vatApplicableFees: inv.contract.vatApplicableFees as VatFeeKey[],
    electricityStart: partial.electricityStart ?? inv.electricityStart,
    electricityEnd: partial.electricityEnd ?? inv.electricityEnd,
    electricityPricePerKwh: inv.electricityPricePerKwh,
    parkingCount: partial.parkingCount ?? inv.parkingCount,
    parkingFeePerVehicle: inv.parkingFeePerVehicle,
    overtimeFee,
    repairFee,
    extraParkingFee,
    serviceFee: partial.serviceFee ?? inv.serviceFee,
    waterPricePerPerson,
    waterOccupants,
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
      overtimeFee,
      repairFee,
      extraParkingFee,
      serviceFee: partial.serviceFee ?? inv.serviceFee,
      waterPricePerPerson,
      waterOccupants,
      waterFee: compute.waterFee,
      totalAmount: compute.totalAmount,
    },
  });
}
