import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  readWorkbook, parseSheet, SHEET_NAMES,
  validateBuilding, validateRoom, validateCustomer, validateContract, validateTransaction,
} from "@/lib/excel-import";
import { nextContractCode, nextTransactionCode } from "@/lib/codes";
import { addMonths } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  const wb = readWorkbook(buf);

  const buildings = parseSheet(wb, SHEET_NAMES.BUILDINGS, validateBuilding);
  const rooms = parseSheet(wb, SHEET_NAMES.ROOMS, validateRoom);
  const customers = parseSheet(wb, SHEET_NAMES.CUSTOMERS, validateCustomer);
  const contracts = parseSheet(wb, SHEET_NAMES.CONTRACTS, validateContract);
  const transactions = parseSheet(wb, SHEET_NAMES.TRANSACTIONS, validateTransaction);

  const allErrors = [
    ...buildings.errors.map((e) => ({ sheet: "Toa_nha", ...e })),
    ...rooms.errors.map((e) => ({ sheet: "Phong", ...e })),
    ...customers.errors.map((e) => ({ sheet: "Khach_hang", ...e })),
    ...contracts.errors.map((e) => ({ sheet: "Hop_dong", ...e })),
    ...transactions.errors.map((e) => ({ sheet: "Giao_dich", ...e })),
  ];
  if (allErrors.length > 0) {
    return NextResponse.json({ error: "Có lỗi trong file", details: allErrors }, { status: 400 });
  }

  const stats = { buildings: 0, rooms: 0, customers: 0, contracts: 0, transactions: 0 };
  const buildingIdByName = new Map<string, string>();

  // 1. Buildings
  for (const b of buildings.rows) {
    const existing = await prisma.building.findFirst({ where: { name: b.name } });
    if (existing) {
      buildingIdByName.set(b.name, existing.id);
      // grant ADMIN ownership if missing
      await prisma.userBuildingPermission.upsert({
        where: { userId_buildingId: { userId: session.user.id, buildingId: existing.id } },
        create: { userId: session.user.id, buildingId: existing.id, permission: "OWNER" },
        update: {},
      });
      continue;
    }
    const created = await prisma.building.create({
      data: {
        name: b.name,
        address: b.address,
        type: b.type,
        setting: { create: {} },
        permissions: { create: { userId: session.user.id, permission: "OWNER" } },
      },
    });
    buildingIdByName.set(b.name, created.id);
    stats.buildings++;
  }

  // 2. Rooms
  for (const r of rooms.rows) {
    const bId = buildingIdByName.get(r.buildingName) ?? (await prisma.building.findFirst({ where: { name: r.buildingName } }))?.id;
    if (!bId) continue;
    buildingIdByName.set(r.buildingName, bId);
    await prisma.room.upsert({
      where: { buildingId_number: { buildingId: bId, number: r.number } },
      create: { buildingId: bId, number: r.number },
      update: {},
    });
    stats.rooms++;
  }

  // 3. Customers — index by buildingId+name
  const customerIdByKey = new Map<string, string>();
  for (const c of customers.rows) {
    const bId = buildingIdByName.get(c.buildingName) ?? (await prisma.building.findFirst({ where: { name: c.buildingName } }))?.id;
    if (!bId) continue;
    buildingIdByName.set(c.buildingName, bId);
    const name = c.type === "INDIVIDUAL" ? c.fullName! : c.companyName!;
    const key = `${bId}::${name}`;
    if (customerIdByKey.has(key)) continue;
    const existing = await prisma.customer.findFirst({
      where: {
        buildingId: bId,
        OR: [{ fullName: name }, { companyName: name }],
      },
    });
    if (existing) {
      customerIdByKey.set(key, existing.id);
      continue;
    }
    const created = await prisma.customer.create({
      data: {
        buildingId: bId,
        type: c.type,
        fullName: c.fullName,
        idNumber: c.idNumber,
        phone: c.phone,
        email: c.email,
        licensePlate: c.licensePlate,
        companyName: c.companyName,
        taxNumber: c.taxNumber,
      },
    });
    customerIdByKey.set(key, created.id);
    stats.customers++;
  }

  // 4. Contracts
  for (const k of contracts.rows) {
    const bId = buildingIdByName.get(k.buildingName) ?? (await prisma.building.findFirst({ where: { name: k.buildingName } }))?.id;
    if (!bId) continue;
    const room = await prisma.room.findUnique({ where: { buildingId_number: { buildingId: bId, number: k.roomNumber } } });
    if (!room) continue;
    const customerKey = `${bId}::${k.customerName}`;
    let custId = customerIdByKey.get(customerKey);
    if (!custId) {
      const existing = await prisma.customer.findFirst({
        where: { buildingId: bId, OR: [{ fullName: k.customerName }, { companyName: k.customerName }] },
      });
      if (existing) custId = existing.id;
    }
    if (!custId) continue;

    // Skip if contract already exists for this room+customer+startDate
    const existing = await prisma.contract.findFirst({
      where: { buildingId: bId, roomId: room.id, startDate: new Date(k.startDate) },
    });
    if (existing) continue;

    const start = new Date(k.startDate);
    const end = addMonths(start, k.termMonths);
    const code = await nextContractCode(bId, start);
    await prisma.contract.create({
      data: {
        buildingId: bId,
        roomId: room.id,
        code,
        startDate: start,
        endDate: end,
        termMonths: k.termMonths,
        paymentDay: k.paymentDay,
        monthlyRent: BigInt(Math.round(k.monthlyRent)),
        vatRate: k.vatRate ?? 0,
        depositAmount: BigInt(Math.round(k.depositAmount ?? 0)),
        electricityPricePerKwh: BigInt(Math.round(k.electricityPricePerKwh ?? 3500)),
        parkingCount: k.parkingCount ?? 0,
        parkingFeePerVehicle: BigInt(Math.round(k.parkingFeePerVehicle ?? 0)),
        serviceFeeAmount: BigInt(Math.round(k.serviceFeeAmount ?? 0)),
        status: "ACTIVE",
        customers: {
          create: [{ customerId: custId, isPrimary: true, orderIdx: 0 }],
        },
      },
    });
    await prisma.room.update({ where: { id: room.id }, data: { status: "OCCUPIED" } });
    stats.contracts++;
  }

  // 5. Transactions
  for (const t of transactions.rows) {
    const bId = buildingIdByName.get(t.buildingName) ?? (await prisma.building.findFirst({ where: { name: t.buildingName } }))?.id;
    if (!bId) continue;
    const cat = t.categoryName
      ? await prisma.transactionCategory.findFirst({ where: { name: t.categoryName, type: t.type } })
      : null;
    const pm = t.paymentMethodName
      ? await prisma.paymentMethod.findFirst({ where: { name: t.paymentMethodName } })
      : null;
    let customerId: string | undefined;
    let partyId: string | undefined;
    let partyKind: "CUSTOMER" | "OTHER" | undefined;
    if (t.partyName) {
      const cust = await prisma.customer.findFirst({
        where: { buildingId: bId, OR: [{ fullName: t.partyName }, { companyName: t.partyName }] },
      });
      if (cust) {
        customerId = cust.id;
        partyKind = "CUSTOMER";
      } else {
        const party = await prisma.party.findFirst({ where: { name: t.partyName } });
        if (party) {
          partyId = party.id;
          partyKind = "OTHER";
        }
      }
    }
    const date = new Date(t.date);
    const code = await nextTransactionCode(bId, t.type);
    await prisma.transaction.create({
      data: {
        buildingId: bId,
        code,
        date,
        type: t.type,
        amount: BigInt(Math.round(t.amount)),
        content: t.content,
        categoryId: cat?.id,
        paymentMethodId: pm?.id,
        customerId,
        partyId,
        partyKind,
        countInBR: t.countInBR ?? true,
        accountingMonth: date.getMonth() + 1,
        accountingYear: date.getFullYear(),
        createdById: session.user.id,
      },
    });
    stats.transactions++;
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
