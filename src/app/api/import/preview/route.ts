import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  readWorkbook, parseSheet, SHEET_NAMES,
  validateBuilding, validateRoom, validateCustomer, validateContract, validateTransaction,
} from "@/lib/excel-import";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  return NextResponse.json({
    buildings,
    rooms,
    customers,
    contracts,
    transactions,
  });
}
