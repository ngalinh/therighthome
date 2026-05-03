import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { InvoiceDetail } from "./invoice-detail";
import { serializeBigInt } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: { params: Promise<{ id: string; invoiceId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id, invoiceId } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({
    where: { id },
    include: { setting: true },
  });
  if (!building) notFound();
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      contract: {
        include: {
          room: true,
          customers: { include: { customer: true } },
        },
      },
      payments: { include: { transaction: true }, orderBy: { paidAt: "desc" } },
    },
  });
  if (!inv || inv.buildingId !== id) notFound();

  const canWrite = await can(session.user.id, session.user.role, id, "invoice.write");
  const canSend = await can(session.user.id, session.user.role, id, "invoice.send");

  // Fall back to current building setting if the invoice's snapshot is 0 —
  // happens for older invoices generated before the setting was filled in.
  const settingFallback = {
    parkingFeePerVehicle: building.setting?.parkingFeePerVehicle.toString() ?? "0",
    electricityPricePerKwh: building.setting?.electricityPricePerKwh.toString() ?? "0",
  };

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader
        title={`Hoá đơn ${inv.code}`}
        description={`${building.name} · Tháng ${inv.month}/${inv.year}`}
        gradient={building.type === "CHDV" ? "chdv" : "vp"}
      />
      <PageBody>
        <InvoiceDetail
          invoice={serializeBigInt(inv)}
          buildingType={building.type}
          settingFallback={settingFallback}
          canWrite={canWrite}
          canSend={canSend}
        />
      </PageBody>
    </AppShell>
  );
}
