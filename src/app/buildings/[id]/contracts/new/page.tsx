import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { NewContractForm } from "./new-contract-form";

export default async function NewContractPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  if (!(await can(session.user.id, session.user.role, id, "contract.write"))) notFound();

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      setting: true,
      rooms: {
        where: { status: { not: "OCCUPIED" } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!building) notFound();

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader
        title="Tạo hợp đồng"
        description={building.name}
        gradient={building.type === "CHDV" ? "chdv" : "vp"}
      />
      <PageBody>
        <NewContractForm
          buildingId={id}
          buildingType={building.type}
          rooms={building.rooms.map((r) => ({ id: r.id, number: r.number }))}
          defaults={{
            electricityPricePerKwh: building.setting?.electricityPricePerKwh.toString() ?? "3500",
            parkingFeePerVehicle: building.setting?.parkingFeePerVehicle.toString() ?? "0",
            serviceFee: building.setting?.serviceFeeAmount.toString() ?? "0",
            paymentDay: 5,
          }}
        />
      </PageBody>
    </AppShell>
  );
}
