import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { EditContractForm } from "./edit-contract-form";
import { serializeBigInt } from "@/lib/utils";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id, contractId } = await params;
  if (!(await can(session.user.id, session.user.role, id, "contract.write"))) notFound();

  const [building, contract, brokerCategory] = await Promise.all([
    prisma.building.findUnique({ where: { id }, include: { setting: true } }),
    prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        room: true,
        yearlyRents: { orderBy: { yearIndex: "asc" } },
        customers: {
          include: {
            customer: {
              select: {
                id: true, type: true,
                fullName: true, companyName: true,
                idNumber: true, taxNumber: true,
                phone: true, email: true, licensePlate: true,
                idCardFrontUrl: true, idCardBackUrl: true,
                businessLicenseUrls: true,
              },
            },
          },
          orderBy: { orderIdx: "asc" },
        },
      },
    }),
    prisma.transactionCategory.findFirst({
      where: { name: "Phí môi giới", type: "EXPENSE" },
    }),
  ]);

  if (!building) notFound();
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (!contract || contract.buildingId !== id) notFound();
  const settingSerialized = building.setting
    ? {
        electricityPricePerKwh: building.setting.electricityPricePerKwh.toString(),
        parkingFeePerVehicle: building.setting.parkingFeePerVehicle.toString(),
      }
    : null;

  // Existing broker fees recorded for this contract (matched by content prefix).
  const brokerFees = await prisma.transaction.findMany({
    where: {
      buildingId: id,
      type: "EXPENSE",
      partyKind: "MOI_GIOI",
      content: { startsWith: `Phí môi giới HĐ ${contract.code}` },
    },
    select: { id: true, code: true, date: true, amount: true, content: true },
    orderBy: { date: "desc" },
  });

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader
        title={`Hợp đồng ${contract.code}`}
        description={`${building.name} · Phòng ${contract.room.number}`}
        gradient={building.type === "CHDV" ? "chdv" : "vp"}
      />
      <PageBody>
        <EditContractForm
          buildingId={id}
          buildingType={building.type}
          contract={serializeBigInt(contract)}
          buildingSetting={settingSerialized}
          brokerCategoryId={brokerCategory?.id ?? null}
          paymentMethods={paymentMethods}
          brokerFees={serializeBigInt(brokerFees)}
        />
      </PageBody>
    </AppShell>
  );
}
