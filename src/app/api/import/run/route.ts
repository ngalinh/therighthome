import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  readWorkbook, parseSheet, SHEETS,
  validateChdv, validateVp,
  type ChdvRow, type VpRow,
} from "@/lib/excel-import";
import { nextContractCode } from "@/lib/codes";
import { addMonths } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

type Stats = { buildings: number; rooms: number; customers: number; contracts: number };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  const wb = readWorkbook(buf);

  const chdv = parseSheet(wb, SHEETS.CHDV, validateChdv);
  const vp = parseSheet(wb, SHEETS.VP, validateVp);

  const allErrors = [
    ...chdv.errors.map((e) => ({ sheet: SHEETS.CHDV, ...e })),
    ...vp.errors.map((e) => ({ sheet: SHEETS.VP, ...e })),
  ];
  if (allErrors.length > 0) {
    return NextResponse.json({ error: "Có lỗi trong file", details: allErrors }, { status: 400 });
  }

  const stats: Stats = { buildings: 0, rooms: 0, customers: 0, contracts: 0 };

  for (const r of chdv.rows) {
    await importChdv(r, session.user.id, stats);
  }
  for (const r of vp.rows) {
    await importVp(r, session.user.id, stats);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT",
      entityType: "Excel",
      after: stats as never,
    },
  });

  return NextResponse.json({ ok: true, stats });
}

async function ensureBuilding(name: string, type: "CHDV" | "VP", userId: string) {
  let b = await prisma.building.findFirst({ where: { name } });
  if (!b) {
    b = await prisma.building.create({
      data: {
        name,
        address: name,
        type,
        setting: { create: {} },
        permissions: { create: { userId, permission: "OWNER" } },
      },
    });
    return { b, created: true };
  }
  await prisma.userBuildingPermission.upsert({
    where: { userId_buildingId: { userId, buildingId: b.id } },
    create: { userId, buildingId: b.id, permission: "OWNER" },
    update: {},
  });
  return { b, created: false };
}

async function ensureRoom(buildingId: string, number: string) {
  const existing = await prisma.room.findUnique({
    where: { buildingId_number: { buildingId, number } },
  });
  if (existing) return { room: existing, created: false };
  const room = await prisma.room.create({
    data: { buildingId, number, status: "AVAILABLE" },
  });
  return { room, created: true };
}

async function importChdv(r: ChdvRow, userId: string, stats: Stats) {
  const { b, created: bCreated } = await ensureBuilding(r.buildingName, "CHDV", userId);
  if (bCreated) stats.buildings++;

  const { room, created: roomCreated } = await ensureRoom(b.id, r.roomNumber);
  if (roomCreated) stats.rooms++;

  // Customer: match by buildingId + (idNumber if provided, else fullName).
  let cust = r.idNumber
    ? await prisma.customer.findFirst({ where: { buildingId: b.id, idNumber: r.idNumber } })
    : null;
  if (!cust) {
    cust = await prisma.customer.findFirst({
      where: { buildingId: b.id, fullName: r.fullName, type: "INDIVIDUAL" },
    });
  }
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        buildingId: b.id,
        type: "INDIVIDUAL",
        fullName: r.fullName,
        idNumber: r.idNumber,
        phone: r.phone,
        licensePlate: r.licensePlate,
      },
    });
    stats.customers++;
  }

  await createContractIfNew(b.id, room.id, cust.id, {
    startDate: r.startDate,
    endDate: r.endDate,
    termMonths: r.termMonths,
    paymentDay: r.paymentDay,
    monthlyRent: r.monthlyRent,
    vatRate: 0,
    depositAmount: r.depositAmount,
    serviceFeeAmount: r.serviceFeeAmount ?? 0,
    notes: r.notes,
  }, stats);
}

async function importVp(r: VpRow, userId: string, stats: Stats) {
  const { b, created: bCreated } = await ensureBuilding(r.buildingName, "VP", userId);
  if (bCreated) stats.buildings++;

  const { room, created: roomCreated } = await ensureRoom(b.id, r.roomNumber);
  if (roomCreated) stats.rooms++;

  let cust = await prisma.customer.findFirst({
    where: { buildingId: b.id, companyName: r.companyName, type: "COMPANY" },
  });
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        buildingId: b.id,
        type: "COMPANY",
        companyName: r.companyName,
        phone: r.phone,
        email: r.email,
      },
    });
    stats.customers++;
  }

  await createContractIfNew(b.id, room.id, cust.id, {
    startDate: r.startDate,
    endDate: r.endDate,
    termMonths: r.termMonths,
    paymentDay: r.paymentDay,
    monthlyRent: r.monthlyRent,
    vatRate: 0.1,
    depositAmount: r.depositAmount,
    serviceFeeAmount: 0,
    notes: r.notes,
  }, stats);
}

type ContractInput = {
  startDate: string;
  endDate?: string;
  termMonths: number;
  paymentDay: number;
  monthlyRent: number;
  vatRate: number;
  depositAmount: number;
  serviceFeeAmount: number;
  notes?: string;
};

async function createContractIfNew(
  buildingId: string,
  roomId: string,
  customerId: string,
  input: ContractInput,
  stats: Stats,
) {
  const start = new Date(input.startDate);
  const existing = await prisma.contract.findFirst({
    where: { buildingId, roomId, startDate: start },
  });
  if (existing) return;

  const end = input.endDate ? new Date(input.endDate) : addMonths(start, input.termMonths);
  const setting = await prisma.buildingSetting.findUnique({ where: { buildingId } });
  const elec = setting?.electricityPricePerKwh ?? BigInt(3500);
  const parking = setting?.parkingFeePerVehicle ?? BigInt(0);
  const code = await nextContractCode(buildingId, start);

  await prisma.contract.create({
    data: {
      buildingId,
      roomId,
      code,
      startDate: start,
      endDate: end,
      termMonths: input.termMonths,
      paymentDay: input.paymentDay,
      monthlyRent: BigInt(Math.round(input.monthlyRent)),
      vatRate: input.vatRate,
      depositAmount: BigInt(Math.round(input.depositAmount)),
      electricityPricePerKwh: elec,
      parkingCount: 0,
      parkingFeePerVehicle: parking,
      serviceFeeAmount: BigInt(Math.round(input.serviceFeeAmount)),
      notes: input.notes,
      status: "ACTIVE",
      customers: { create: [{ customerId, isPrimary: true, orderIdx: 0 }] },
    },
  });
  await prisma.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
  stats.contracts++;
}
