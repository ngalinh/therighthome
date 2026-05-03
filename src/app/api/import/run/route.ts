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

  // Group consecutive rows by (buildingName + roomNumber + startDate). Each
  // group is a contract with one or more customers — the first row provides
  // contract terms + the primary customer; subsequent rows are extra
  // tenants/co-renters on the SAME contract.
  for (const group of groupRows(chdv.rows)) {
    await importChdvGroup(group, session.user.id, stats);
  }
  for (const group of groupRows(vp.rows)) {
    await importVpGroup(group, session.user.id, stats);
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

function groupKey(r: { buildingName: string; roomNumber: string; startDate?: string }): string {
  return `${r.buildingName}::${r.roomNumber}::${r.startDate ?? ""}`;
}

function groupRows<T extends { buildingName: string; roomNumber: string; startDate?: string }>(rows: T[]): T[][] {
  const groups: T[][] = [];
  let cur: T[] = [];
  let curKey = "";
  for (const r of rows) {
    const k = groupKey(r);
    if (k !== curKey) {
      if (cur.length) groups.push(cur);
      cur = [r];
      curKey = k;
    } else {
      cur.push(r);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
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

async function ensureChdvCustomer(buildingId: string, r: ChdvRow, stats: Stats): Promise<string | null> {
  if (!r.fullName && !r.idNumber) return null;
  let cust = r.idNumber
    ? await prisma.customer.findFirst({ where: { buildingId, idNumber: r.idNumber } })
    : null;
  if (!cust && r.fullName) {
    cust = await prisma.customer.findFirst({
      where: { buildingId, fullName: r.fullName, type: "INDIVIDUAL" },
    });
  }
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        buildingId,
        type: "INDIVIDUAL",
        fullName: r.fullName,
        idNumber: r.idNumber,
        phone: r.phone,
        licensePlate: r.licensePlate,
      },
    });
    stats.customers++;
  }
  return cust.id;
}

async function ensureVpCustomer(buildingId: string, r: VpRow, stats: Stats): Promise<string | null> {
  if (!r.companyName) return null;
  let cust = await prisma.customer.findFirst({
    where: { buildingId, companyName: r.companyName, type: "COMPANY" },
  });
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        buildingId,
        type: "COMPANY",
        companyName: r.companyName,
        phone: r.phone,
        email: r.email,
      },
    });
    stats.customers++;
  }
  return cust.id;
}

async function importChdvGroup(group: ChdvRow[], userId: string, stats: Stats) {
  const head = group[0];
  const { b, created: bCreated } = await ensureBuilding(head.buildingName, "CHDV", userId);
  if (bCreated) stats.buildings++;
  const { room, created: roomCreated } = await ensureRoom(b.id, head.roomNumber);
  if (roomCreated) stats.rooms++;

  const customerIds: string[] = [];
  for (const r of group) {
    const id = await ensureChdvCustomer(b.id, r, stats);
    if (id && !customerIds.includes(id)) customerIds.push(id);
  }

  if (customerIds.length === 0) return;
  if (!head.startDate || head.monthlyRent === undefined || head.paymentDay === undefined) return;
  if (head.termMonths === undefined && !head.endDate) return;

  await createContractIfNew(b.id, room.id, customerIds, {
    startDate: head.startDate,
    endDate: head.endDate,
    termMonths: head.termMonths!,
    paymentDay: head.paymentDay,
    monthlyRent: head.monthlyRent,
    vatRate: 0,
    depositAmount: head.depositAmount ?? 0,
    serviceFeeAmount: head.serviceFeeAmount ?? 0,
    notes: head.notes,
  }, stats);
}

async function importVpGroup(group: VpRow[], userId: string, stats: Stats) {
  const head = group[0];
  const { b, created: bCreated } = await ensureBuilding(head.buildingName, "VP", userId);
  if (bCreated) stats.buildings++;
  const { room, created: roomCreated } = await ensureRoom(b.id, head.roomNumber);
  if (roomCreated) stats.rooms++;

  const customerIds: string[] = [];
  for (const r of group) {
    const id = await ensureVpCustomer(b.id, r, stats);
    if (id && !customerIds.includes(id)) customerIds.push(id);
  }

  if (customerIds.length === 0) return;
  if (!head.startDate || head.monthlyRent === undefined || head.paymentDay === undefined) return;
  if (head.termMonths === undefined && !head.endDate) return;

  await createContractIfNew(b.id, room.id, customerIds, {
    startDate: head.startDate,
    endDate: head.endDate,
    termMonths: head.termMonths!,
    paymentDay: head.paymentDay,
    monthlyRent: head.monthlyRent,
    vatRate: 0.1,
    depositAmount: head.depositAmount ?? 0,
    serviceFeeAmount: 0,
    notes: head.notes,
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
  customerIds: string[],
  input: ContractInput,
  stats: Stats,
) {
  const start = new Date(input.startDate);
  const existing = await prisma.contract.findFirst({
    where: { buildingId, roomId, startDate: start },
    include: { customers: { select: { customerId: true, orderIdx: true } } },
  });

  if (existing) {
    // Contract already imported in a previous run. Link any customers
    // present in this group that aren't already attached.
    const have = new Set(existing.customers.map((c) => c.customerId));
    let nextIdx = existing.customers.reduce((m, c) => Math.max(m, c.orderIdx), -1) + 1;
    for (const cid of customerIds) {
      if (have.has(cid)) continue;
      await prisma.contractCustomer.create({
        data: {
          contractId: existing.id,
          customerId: cid,
          isPrimary: false,
          orderIdx: nextIdx++,
        },
      });
    }
    return;
  }

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
      customers: {
        create: customerIds.map((cid, i) => ({
          customerId: cid,
          isPrimary: i === 0,
          orderIdx: i,
        })),
      },
    },
  });
  await prisma.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
  stats.contracts++;
}
