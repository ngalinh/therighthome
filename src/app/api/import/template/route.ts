import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildTemplateWorkbook } from "@/lib/excel-import";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const wb = buildTemplateWorkbook();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="therighthome-import-template.xlsx"',
    },
  });
}
