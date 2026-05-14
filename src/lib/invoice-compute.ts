// Pure compute helpers for invoice totals.
//
// Semantic IMPORTANT:
//   `rentAmount` is the AFTER-VAT total the tenant pays as rent.
//   `vatAmount` is the VAT portion INCLUDED in `rentAmount` (rent × vatRate).
//   `vatAmount` is informational only — it is NOT added on top of `rentAmount`.
//
//   `vatApplicableFees` (VP only) selects which non-rent fees get an extra
//   VAT charge on top (electricity, parking, overtime, repair, extra parking).
//   The fee amounts themselves are stored NET; VAT is added on top when
//   computing `totalAmount`.
//
// Example: if monthly rent is 21M with VAT 10%:
//   rentAmount = 21,000,000   (what the tenant is billed)
//   vatAmount  = 2,100,000    (the VAT portion within the 21M)
//   pre-VAT rent (informational) = 18,900,000

export type VatFeeKey = "electricity" | "parking" | "overtime" | "repair" | "extraParking";

export type InvoiceComputeInput = {
  rentAmount: bigint;        // after-VAT rent (what we charge)
  vatRate: number;           // 0..1 — used ONLY to break out VAT amount for display
  vatApplicableFees?: VatFeeKey[]; // which non-rent fees get +VAT added on top
  electricityStart: number | null | undefined;
  electricityEnd: number | null | undefined;
  electricityPricePerKwh: bigint;
  parkingCount: number;
  parkingFeePerVehicle: bigint;
  overtimeFee: bigint;
  repairFee: bigint;
  extraParkingFee: bigint;
  serviceFee: bigint;
  waterPricePerPerson: bigint;
  waterOccupants: number;
};

export type InvoiceComputeResult = {
  vatAmount: bigint;         // informational portion of rent that is VAT
  electricityFee: bigint;
  parkingFee: bigint;
  waterFee: bigint;
  feeVatAmount: bigint;      // total extra VAT added on top of non-rent fees
  totalAmount: bigint;       // = rent + electricity + parking + overtime + repair + extraParking + service + water + feeVatAmount
};

function vatOn(amount: bigint, vatRate: number): bigint {
  return BigInt(Math.round(Number(amount) * vatRate));
}

export function computeInvoice(d: InvoiceComputeInput): InvoiceComputeResult {
  const vatAmount = BigInt(Math.round(Number(d.rentAmount) * d.vatRate));
  const kwh =
    d.electricityStart != null && d.electricityEnd != null && d.electricityEnd > d.electricityStart
      ? d.electricityEnd - d.electricityStart
      : 0;
  const electricityFee = BigInt(kwh) * d.electricityPricePerKwh;
  const parkingFee = BigInt(d.parkingCount) * d.parkingFeePerVehicle;
  const waterFee = BigInt(d.waterOccupants) * d.waterPricePerPerson;

  const applicable = new Set(d.vatApplicableFees ?? []);
  const feeVatAmount =
    (applicable.has("electricity") ? vatOn(electricityFee, d.vatRate) : 0n) +
    (applicable.has("parking") ? vatOn(parkingFee, d.vatRate) : 0n) +
    (applicable.has("overtime") ? vatOn(d.overtimeFee, d.vatRate) : 0n) +
    (applicable.has("repair") ? vatOn(d.repairFee, d.vatRate) : 0n) +
    (applicable.has("extraParking") ? vatOn(d.extraParkingFee, d.vatRate) : 0n);

  const totalAmount =
    d.rentAmount +
    electricityFee +
    parkingFee +
    d.overtimeFee +
    d.repairFee +
    d.extraParkingFee +
    d.serviceFee +
    waterFee +
    feeVatAmount;
  return { vatAmount, electricityFee, parkingFee, waterFee, feeVatAmount, totalAmount };
}

/**
 * Given a contract start date and a target invoice month/year, return the
 * year index of the contract that the invoice falls in (1-based).
 * Year 1 = first 12 months from start.
 */
export function getContractYearIndex(startDate: Date, invoiceMonth: number, invoiceYear: number): number {
  const invoiceDate = new Date(invoiceYear, invoiceMonth - 1, Math.min(startDate.getDate(), 28));
  let years = invoiceDate.getFullYear() - startDate.getFullYear();
  if (
    invoiceDate.getMonth() < startDate.getMonth() ||
    (invoiceDate.getMonth() === startDate.getMonth() && invoiceDate.getDate() < startDate.getDate())
  ) {
    years--;
  }
  return Math.max(1, years + 1);
}

/**
 * Pick the effective rent for a given (month, year) given a contract's
 * monthlyRent (default) and any per-year overrides.
 */
export function getEffectiveRent(
  startDate: Date,
  monthlyRent: bigint,
  yearlyRents: { yearIndex: number; rent: bigint }[],
  invoiceMonth: number,
  invoiceYear: number,
): bigint {
  const yearIdx = getContractYearIndex(startDate, invoiceMonth, invoiceYear);
  const match = yearlyRents.find((y) => y.yearIndex === yearIdx);
  return match ? match.rent : monthlyRent;
}
