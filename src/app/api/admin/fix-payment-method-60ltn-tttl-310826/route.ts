import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-off: toà "60 Lê Trung Nghĩa - CHDV" đang hiển thị tài khoản thanh toán
// K300 trên Phiếu thanh toán (do PTTT K300 đang gắn riêng cho toà này). Gắn
// PTTT "TTTL" cho toà này và gỡ mọi PTTT khác đang gắn riêng, để Phiếu thanh
// toán (bao gồm 2 hoá đơn T9 đã tạo, vì tài khoản TT được tính động lúc hiển
// thị chứ không lưu cứng vào hoá đơn) đổi sang hiển thị tài khoản TTTL.
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const building = await prisma.building.findFirst({
    where: { address: { contains: "60 Lê Trung Nghĩa" }, type: "CHDV" },
    select: { id: true, name: true, address: true },
  });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const tttlPM = await prisma.paymentMethod.findFirst({
    where: { name: "TTTL" },
    select: { id: true, name: true },
  });
  if (!tttlPM) return NextResponse.json({ error: "TTTL payment method not found" }, { status: 404 });

  const currentlyAttached = await prisma.paymentMethod.findMany({
    where: { buildings: { some: { id: building.id } }, id: { not: tttlPM.id } },
    select: { id: true, name: true },
  });

  await prisma.$transaction([
    ...currentlyAttached.map((pm) =>
      prisma.paymentMethod.update({
        where: { id: pm.id },
        data: { buildings: { disconnect: { id: building.id } } },
      }),
    ),
    prisma.paymentMethod.update({
      where: { id: tttlPM.id },
      data: { buildings: { connect: { id: building.id } } },
    }),
  ]);

  return NextResponse.json({
    building: building.name,
    detached: currentlyAttached.map((pm) => pm.name),
    attached: tttlPM.name,
  });
}
