import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

// $ button: fold the OT fee into the invoice for the (room, month) of the OT date.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const ot = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!ot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, ot.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ot.invoiceId) {
    return NextResponse.json({ error: "Đã ghi nhận vào hoá đơn rồi" }, { status: 400 });
  }
  if (!ot.roomId) {
    return NextResponse.json({ error: "Phải chọn phòng để ghi vào hoá đơn" }, { status: 400 });
  }
  if (ot.fee <= BigInt(0)) {
    return NextResponse.json({ error: "Phí ngoài giờ phải lớn hơn 0" }, { status: 400 });
  }

  const month = ot.date.getMonth() + 1;
  const year = ot.date.getFullYear();

  // Find the active contract on the OT date for this room.
  const contract = await prisma.contract.findFirst({
    where: {
      roomId: ot.roomId,
      startDate: { lte: ot.date },
      endDate: { gte: ot.date },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!contract) {
    return NextResponse.json({ error: "Không tìm thấy hợp đồng cho phòng vào ngày này" }, { status: 400 });
  }
  const invoice = await prisma.invoice.findFirst({
    where: { contractId: contract.id, month, year },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Chưa có hoá đơn tháng này — tạo hoá đơn trước" }, { status: 400 });
  }

  const newOt = invoice.overtimeFee + ot.fee;
  const total =
    invoice.rentAmount +
    invoice.electricityFee +
    invoice.parkingFee +
    newOt +
    invoice.serviceFee;
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { overtimeFee: newOt, totalAmount: total },
  });
  await prisma.overtimeRequest.update({
    where: { id },
    data: { invoiceId: invoice.id },
  });
  return NextResponse.json({ invoiceId: invoice.id, invoiceCode: invoice.code });
}
