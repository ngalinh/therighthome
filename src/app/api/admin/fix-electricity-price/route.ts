import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeInvoice, type VatFeeKey } from "@/lib/invoice-compute";

const OLD_PRICE = 3500n;
const NEW_PRICE = 4000n;

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      electricityPricePerKwh: OLD_PRICE,
      building: { type: "VP" },
      status: { not: "CANCELLED" },
    },
    include: {
      contract: { select: { vatRate: true, vatApplicableFees: true } },
    },
  });

  const results: { code: string; oldTotal: string; newTotal: string; kWh: number }[] = [];

  for (const inv of invoices) {
    const compute = computeInvoice({
      rentAmount: inv.rentAmount,
      vatRate: inv.contract.vatRate,
      vatApplicableFees: inv.contract.vatApplicableFees as VatFeeKey[],
      electricityStart: inv.electricityStart,
      electricityEnd: inv.electricityEnd,
      electricityPricePerKwh: NEW_PRICE,
      parkingCount: inv.parkingCount,
      parkingFeePerVehicle: inv.parkingFeePerVehicle,
      overtimeFee: inv.overtimeFee,
      repairFee: inv.repairFee,
      extraParkingFee: inv.extraParkingFee,
      serviceFee: inv.serviceFee,
      waterPricePerPerson: inv.waterPricePerPerson,
      waterOccupants: inv.waterOccupants,
    });

    const kWh =
      inv.electricityStart != null && inv.electricityEnd != null && inv.electricityEnd > inv.electricityStart
        ? inv.electricityEnd - inv.electricityStart
        : 0;

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        electricityPricePerKwh: NEW_PRICE,
        electricityFee: compute.electricityFee,
        totalAmount: compute.totalAmount,
      },
    });

    results.push({
      code: inv.code,
      oldTotal: inv.totalAmount.toString(),
      newTotal: compute.totalAmount.toString(),
      kWh,
    });
  }

  return NextResponse.json({ updated: results.length, results });
}
