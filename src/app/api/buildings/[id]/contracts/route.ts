import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextContractCode } from "@/lib/codes";
import { renderContractDocx } from "@/lib/docx";
import { addMonths, formatDateVN, formatVND } from "@/lib/utils";

const customerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("INDIVIDUAL"),
    data: z.object({
      fullName: z.string().min(1),
      idNumber: z.string().min(1),
      dateOfBirth: z.string().optional(),
      gender: z.string().optional(),
      hometown: z.string().optional(),
      permanentAddress: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      licensePlate: z.string().optional(),
      frontUrl: z.string().optional(),
      backUrl: z.string().optional(),
    }),
  }),
  z.object({
    kind: z.literal("COMPANY"),
    data: z.object({
      companyName: z.string().min(1),
      taxNumber: z.string().min(1),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      businessLicenseUrls: z.array(z.string()).max(3).optional(),
    }),
  }),
]);

const createSchema = z.object({
  roomId: z.string(),
  startDate: z.string(),
  termMonths: z.number().int().min(1).max(60),
  paymentDay: z.number().int().min(1).max(28),
  monthlyRent: z.string(),
  vatRate: z.number().min(0).max(1),
  depositAmount: z.string(),
  parkingCount: z.number().int().min(0),
  parkingFeePerVehicle: z.string(),
  serviceFeeAmount: z.string(),
  waterPricePerPerson: z.string().optional(),
  electricityPricePerKwh: z.string(),
  notes: z.string().optional(),
  customers: z.array(customerSchema).min(1),
  yearlyRents: z.array(z.object({ yearIndex: z.number(), rent: z.string() })).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: buildingId } = await ctx.params;
  if (!(await can(session.user.id, session.user.role, buildingId, "contract.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const building = await prisma.building.findUnique({ where: { id: buildingId }, include: { setting: true } });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const start = new Date(d.startDate);
  const end = addMonths(start, d.termMonths);
  const code = await nextContractCode(buildingId, start);

  const contract = await prisma.$transaction(async (tx) => {
    const customers = await Promise.all(
      d.customers.map((c) => {
        if (c.kind === "INDIVIDUAL") {
          return tx.customer.create({
            data: {
              buildingId,
              type: "INDIVIDUAL",
              fullName: c.data.fullName,
              idNumber: c.data.idNumber,
              dateOfBirth: c.data.dateOfBirth ? new Date(c.data.dateOfBirth) : null,
              hometown: c.data.hometown,
              phone: c.data.phone,
              email: c.data.email,
              licensePlate: c.data.licensePlate,
              idCardFrontUrl: c.data.frontUrl,
              idCardBackUrl: c.data.backUrl,
            },
          });
        }
        return tx.customer.create({
          data: {
            buildingId,
            type: "COMPANY",
            companyName: c.data.companyName,
            taxNumber: c.data.taxNumber,
            fullName: c.data.contactName,
            phone: c.data.phone,
            email: c.data.email,
            businessLicenseUrls: c.data.businessLicenseUrls ?? [],
          },
        });
      }),
    );

    const created = await tx.contract.create({
      data: {
        buildingId,
        roomId: d.roomId,
        code,
        startDate: start,
        endDate: end,
        termMonths: d.termMonths,
        paymentDay: d.paymentDay,
        monthlyRent: BigInt(d.monthlyRent),
        vatRate: d.vatRate,
        depositAmount: BigInt(d.depositAmount),
        electricityPricePerKwh: BigInt(d.electricityPricePerKwh),
        parkingCount: d.parkingCount,
        parkingFeePerVehicle: BigInt(d.parkingFeePerVehicle),
        serviceFeeAmount: BigInt(d.serviceFeeAmount),
        waterPricePerPerson: d.waterPricePerPerson ? BigInt(d.waterPricePerPerson) : 0n,
        notes: d.notes,
        status: "ACTIVE",
        customers: {
          create: customers.map((c, i) => ({
            customerId: c.id,
            isPrimary: i === 0,
            orderIdx: i,
          })),
        },
        yearlyRents: d.yearlyRents
          ? { create: d.yearlyRents.map((y) => ({ yearIndex: y.yearIndex, rent: BigInt(y.rent) })) }
          : undefined,
      },
      include: { room: true, customers: { include: { customer: true } } },
    });

    await tx.room.update({ where: { id: d.roomId }, data: { status: "OCCUPIED" } });

    return created;
  });

  // Try to generate DOCX from template (best-effort, non-blocking on failure)
  if (building.setting?.contractTemplateUrl) {
    try {
      const primary = contract.customers[0]?.customer;
      const docxUrl = await renderContractDocx(building.setting.contractTemplateUrl, {
        ma_hd: contract.code,
        toa_nha: building.name,
        dia_chi_toa: building.address,
        so_phong: contract.room.number,
        ten_khach: primary?.fullName ?? primary?.companyName ?? "",
        cccd: primary?.idNumber ?? "",
        sdt: primary?.phone ?? "",
        email: primary?.email ?? "",
        cong_ty: primary?.companyName ?? "",
        mst: primary?.taxNumber ?? "",
        ngay_bat_dau: formatDateVN(contract.startDate),
        ngay_ket_thuc: formatDateVN(contract.endDate),
        thoi_han: `${d.termMonths} tháng`,
        gia_thue: formatVND(contract.monthlyRent),
        tien_coc: formatVND(contract.depositAmount),
        ngay_thanh_toan: String(d.paymentDay),
        ghi_chu: d.notes ?? "",
      });
      await prisma.contract.update({ where: { id: contract.id }, data: { generatedDocxUrl: docxUrl } });
    } catch (e) {
      console.error("DOCX render failed", e);
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: "CREATE", entityType: "Contract",
      entityId: contract.id, buildingId, after: { code: contract.code } as never,
    },
  });

  return NextResponse.json({ id: contract.id, code: contract.code });
}
