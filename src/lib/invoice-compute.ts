// Pure compute helpers for invoice totals.

export type InvoiceComputeInput = {
  rentAmount: bigint;
  vatRate: number; // 0..1
  electricityStart: number | null | undefined;
  electricityEnd: number | null | undefined;
  electricityPricePerKwh: bigint;
  parkingCount: number;
  parkingFeePerVehicle: bigint;
  overtimeFee: bigint;
  serviceFee: bigint;
};

export type InvoiceComputeResult = {
  vatAmount: bigint;
  electricityFee: bigint;
  parkingFee: bigint;
  totalAmount: bigint;
};

export function computeInvoice(d: InvoiceComputeInput): InvoiceComputeResult {
  const vatAmount = BigInt(Math.round(Number(d.rentAmount) * d.vatRate));
  const kwh =
    d.electricityStart != null && d.electricityEnd != null && d.electricityEnd > d.electricityStart
      ? d.electricityEnd - d.electricityStart
      : 0;
  const electricityFee = BigInt(kwh) * d.electricityPricePerKwh;
  const parkingFee = BigInt(d.parkingCount) * d.parkingFeePerVehicle;
  const totalAmount = d.rentAmount + vatAmount + electricityFee + parkingFee + d.overtimeFee + d.serviceFee;
  return { vatAmount, electricityFee, parkingFee, totalAmount };
}
