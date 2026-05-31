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

  const building = await prisma.building.findFirst({
    where: { name: { contains: "Trần Thái Tông" } },
    select: { id: true, name: true },
  });
  if (!building) return NextResponse.json({ error: "Không tìm thấy toà nhà" }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: {
      buildingId: building.id,
      month: 6,
      year: 2026,
      isManual: false,
      electricityPricePerKwh: OLD_PRICE,
      status: { not: "CANCELLED" },
    },
    include: {
      contract: { select: { vatRate: true, vatApplicableFees: true } },
      electricityLines: true,
    },
  });

  const results: { code: string; oldTotal: string; newTotal: string; kWh: number }[] = [];

  for (const inv of invoices) {
    let kWh = 0;
    if (inv.electricityLines.length > 0) {
      kWh = inv.electricityLines.reduce((s, l) => s + Math.max(0, (l.end ?? 0) - (l.start ?? 0)), 0);
    } else if (inv.electricityStart != null && inv.electricityEnd != null && inv.electricityEnd > inv.electricityStart) {
      kWh = inv.electricityEnd - inv.electricityStart;
    }

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

    results.push({ code: inv.code, oldTotal: inv.totalAmount.toString(), newTotal: compute.totalAmount.toString(), kWh });

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        electricityPricePerKwh: NEW_PRICE,
        electricityFee: compute.electricityFee,
        totalAmount: compute.totalAmount,
      },
    });
  }

  return NextResponse.json({ building: building.name, updated: results.length, results });
}
