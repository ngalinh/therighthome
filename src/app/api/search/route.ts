import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight multi-entity search for the topbar. Searches buildings,
// customers, contracts, and invoices the caller has access to. Each entity
// returns up to TAKE_PER_ENTITY rows, sorted by recency. Case-insensitive
// substring match (Prisma `contains` + `mode: insensitive`).

const TAKE_PER_ENTITY = 5;
const MAX_Q_LENGTH = 100;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, MAX_Q_LENGTH);
  if (!q) {
    return NextResponse.json({ buildings: [], customers: [], contracts: [], invoices: [] });
  }

  const accessible = await listAccessibleBuildings(session.user.id, session.user.role);
  const buildingIds = accessible.map((b) => b.id);
  if (buildingIds.length === 0) {
    return NextResponse.json({ buildings: [], customers: [], contracts: [], invoices: [] });
  }
  const buildingNameById = new Map(accessible.map((b) => [b.id, b.name]));

  const [buildings, customers, contracts, invoices] = await Promise.all([
    prisma.building.findMany({
      where: {
        id: { in: buildingIds },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, address: true, type: true },
      orderBy: { name: "asc" },
      take: TAKE_PER_ENTITY,
    }),
    prisma.customer.findMany({
      where: {
        buildingId: { in: buildingIds },
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { idNumber: { contains: q, mode: "insensitive" } },
          { licensePlate: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, buildingId: true, type: true,
        fullName: true, companyName: true, phone: true,
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE_PER_ENTITY,
    }),
    prisma.contract.findMany({
      where: {
        buildingId: { in: buildingIds },
        code: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true, buildingId: true, code: true, status: true,
        room: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
      take: TAKE_PER_ENTITY,
    }),
    prisma.invoice.findMany({
      where: {
        buildingId: { in: buildingIds },
        code: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true, buildingId: true, code: true, status: true,
        month: true, year: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: TAKE_PER_ENTITY,
    }),
  ]);

  return NextResponse.json({
    buildings: buildings.map((b) => ({
      id: b.id, name: b.name, address: b.address, type: b.type,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      buildingId: c.buildingId,
      buildingName: buildingNameById.get(c.buildingId) ?? "",
      type: c.type,
      name: c.type === "COMPANY" ? c.companyName ?? "" : c.fullName ?? "",
      phone: c.phone ?? "",
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      buildingId: c.buildingId,
      buildingName: buildingNameById.get(c.buildingId) ?? "",
      code: c.code,
      status: c.status,
      roomNumber: c.room?.number ?? "",
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      buildingId: i.buildingId,
      buildingName: buildingNameById.get(i.buildingId) ?? "",
      code: i.code,
      status: i.status,
      month: i.month,
      year: i.year,
    })),
  });
}
