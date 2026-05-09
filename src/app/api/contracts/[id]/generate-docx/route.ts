import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { renderContractDocx } from "@/lib/docx";
import { buildContractPlaceholders, resolveTemplateUrl } from "@/lib/contract-template";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/contracts/:id/generate-docx[?force=1]
// Generates the contract DOCX from the building's template (or app default).
// By default refuses if a DOCX already exists; pass `?force=1` to regenerate
// (used after uploading a new template).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const force = req.nextUrl.searchParams.get("force") === "1";

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      room: true,
      building: { include: { setting: true } },
      customers: { include: { customer: true }, orderBy: { orderIdx: "asc" } },
    },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, contract.buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (contract.generatedDocxUrl && !force) {
    return NextResponse.json({ error: "Hợp đồng đã được tạo trước đó" }, { status: 409 });
  }

  const primary = contract.customers[0]?.customer;
  const appSetting = await prisma.appSetting.findUnique({ where: { id: 1 } });
  const templateUrl = resolveTemplateUrl({
    buildingType: contract.building.type,
    primaryType: primary?.type,
    buildingSetting: contract.building.setting,
    appSetting,
  });
  if (!templateUrl) {
    return NextResponse.json(
      { error: "Chưa có mẫu hợp đồng. Vào Cài đặt toà nhà hoặc Cài đặt chung để upload mẫu .docx." },
      { status: 400 },
    );
  }

  try {
    const docxUrl = await renderContractDocx(
      templateUrl,
      buildContractPlaceholders({
        contract,
        building: contract.building,
        room: contract.room,
        customers: contract.customers.map((cc) => cc.customer),
      }),
    );
    await prisma.contract.update({ where: { id }, data: { generatedDocxUrl: docxUrl } });
    return NextResponse.json({ url: docxUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-docx] failed:", msg, e);
    return NextResponse.json({ error: `Tạo HĐ thất bại: ${msg}` }, { status: 500 });
  }
}
