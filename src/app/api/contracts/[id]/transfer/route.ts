import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextContractCode, nextTransactionCode } from "@/lib/codes";
import { contractEndDate } from "@/lib/utils";

const schema = z.object({
  newRoomId: z.string().min(1),
  transferDate: z.string(),
  newMonthlyRent: z.string(),           // VND string
  newDepositAmount: z.string(),         // VND string
  paymentMethodId: z.string().optional(), // required if deposit changes
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const c = await prisma.contract.findUnique({
    where: { id },
    include: { customers: { orderBy: { orderIdx: "asc" } } },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "ACTIVE") return NextResponse.json({ error: "Chỉ chuyển phòng hợp đồng đang ACTIVE" }, { status: 400 });
  if (!(await can(session.user.id, session.user.role, c.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  if (d.newRoomId === c.roomId) {
    return NextResponse.json({ error: "Phòng mới phải khác phòng cũ" }, { status: 400 });
  }

  const newRoom = await prisma.room.findUnique({ where: { id: d.newRoomId } });
  if (!newRoom) return NextResponse.json({ error: "Phòng không tồn tại" }, { status: 404 });
  if (newRoom.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Phòng mới phải đang trống (AVAILABLE)" }, { status: 400 });
  }

  const transferDate = new Date(d.transferDate);
  const newRent = BigInt(d.newMonthlyRent);
  const newDeposit = BigInt(d.newDepositAmount);
  const oldDeposit = c.depositAmount;
  const depositDiff = newDeposit - oldDeposit; // positive = thu thêm, negative = hoàn lại

  if (depositDiff !== 0n && !d.paymentMethodId) {
    return NextResponse.json({ error: "Cần chọn phương thức thanh toán khi tiền cọc thay đổi" }, { status: 400 });
  }

  const newCode = await nextContractCode(c.buildingId, transferDate);

  const newContract = await prisma.$transaction(async (tx) => {
    // 1. Close old contract
    await tx.contract.update({
      where: { id },
      data: { status: "TRANSFERRED", terminatedAt: transferDate },
    });

    // 2. Free old room if no other active contracts
    const stillActive = await tx.contract.count({ where: { roomId: c.roomId, status: "ACTIVE" } });
    if (stillActive === 0) {
      await tx.room.update({ where: { id: c.roomId }, data: { status: "AVAILABLE" } });
    }

    // 3. Create new contract (copy all fields, update room + rent + deposit)
    const created = await tx.contract.create({
      data: {
        buildingId: c.buildingId,
        roomId: d.newRoomId,
        code: newCode,
        startDate: transferDate,
        endDate: c.endDate,
        termMonths: c.termMonths,
        paymentDay: c.paymentDay,
        monthlyRent: newRent,
        vatRate: c.vatRate,
        depositAmount: newDeposit,
        electricityPricePerKwh: c.electricityPricePerKwh,
        parkingCount: c.parkingCount,
        parkingFeePerVehicle: c.parkingFeePerVehicle,
        serviceFeeAmount: c.serviceFeeAmount,
        waterPricePerPerson: c.waterPricePerPerson,
        rentPaymentCycleMonths: c.rentPaymentCycleMonths,
        isOpenEnded: c.isOpenEnded,
        temporaryResidenceStatus: "NOT_REGISTERED",
        temporaryResidenceIsIndefinite: false,
        status: "ACTIVE",
        transferredFromId: id,
        notes: c.notes,
        customers: {
          create: c.customers.map((cc) => ({
            customerId: cc.customerId,
            isPrimary: cc.isPrimary,
            orderIdx: cc.orderIdx,
          })),
        },
      },
    });

    // 4. Mark new room OCCUPIED
    await tx.room.update({ where: { id: d.newRoomId }, data: { status: "OCCUPIED" } });

    // 5. Handle deposit difference
    if (depositDiff !== 0n && d.paymentMethodId) {
      const customer = c.customers.find((cc) => cc.isPrimary);
      if (depositDiff > 0n) {
        // Thu thêm cọc
        const code = await nextTransactionCode(c.buildingId, "INCOME");
        const cat = await tx.transactionCategory.findFirst({
          where: { type: "INCOME", name: { contains: "cọc" } },
        });
        await tx.transaction.create({
          data: {
            buildingId: c.buildingId,
            code,
            date: transferDate,
            type: "INCOME",
            amount: depositDiff,
            content: `Thu thêm cọc chuyển phòng - HĐ ${newCode}`,
            categoryId: cat?.id,
            paymentMethodId: d.paymentMethodId,
            partyKind: "CUSTOMER",
            customerId: customer?.customerId,
            countInBR: false,
            showInCashbook: true,
            accountingMonth: transferDate.getMonth() + 1,
            accountingYear: transferDate.getFullYear(),
            createdById: session.user.id,
          },
        });
      } else {
        // Hoàn bớt cọc
        const code = await nextTransactionCode(c.buildingId, "EXPENSE");
        const cat = await tx.transactionCategory.findFirst({
          where: { type: "EXPENSE", name: { contains: "cọc" } },
        });
        await tx.transaction.create({
          data: {
            buildingId: c.buildingId,
            code,
            date: transferDate,
            type: "EXPENSE",
            amount: -depositDiff,
            content: `Hoàn bớt cọc chuyển phòng - HĐ ${c.code}`,
            categoryId: cat?.id,
            paymentMethodId: d.paymentMethodId,
            partyKind: "CUSTOMER",
            customerId: customer?.customerId,
            countInBR: false,
            showInCashbook: true,
            accountingMonth: transferDate.getMonth() + 1,
            accountingYear: transferDate.getFullYear(),
            createdById: session.user.id,
          },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ id: newContract.id, code: newContract.code });
}
