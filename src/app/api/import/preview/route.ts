import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  readWorkbook, parseSheet, SHEETS,
  validateChdv, validateVp,
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

  const chdv = parseSheet(wb, SHEETS.CHDV, validateChdv);
  const vp = parseSheet(wb, SHEETS.VP, validateVp);

  return NextResponse.json({ chdv, vp });
}
