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
      payments: {
        include: { transaction: { include: { paymentMethod: true } } },
        orderBy: { paidAt: "desc" },
      },
    },
  });
  if (!inv || inv.buildingId !== id) notFound();

  // Payment methods available for this building type — used in the
  // payment-history edit dropdown.
  const paymentMethodsForEdit = await prisma.paymentMethod.findMany({
    where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, isCash: true },
  });

  const canWrite = await can(session.user.id, session.user.role, id, "invoice.write");
  const canSend = await can(session.user.id, session.user.role, id, "invoice.send");

  // Fall back to current building setting if the invoice's snapshot is 0 —
  // happens for older invoices generated before the setting was filled in.
  const settingFallback = {
    parkingFeePerVehicle: building.setting?.parkingFeePerVehicle.toString() ?? "0",
    electricityPricePerKwh: building.setting?.electricityPricePerKwh.toString() ?? "0",
  };

  // Pick a non-cash payment method to display on the receipt. Prefer one that
  // is explicitly attached to this building; otherwise fall back to one of
  // the same building type that has no specific building bindings.
  const specific = await prisma.paymentMethod.findFirst({
    where: { isCash: false, buildings: { some: { id } } },
    orderBy: { name: "asc" },
  });
  const fallback = specific
    ? null
    : await prisma.paymentMethod.findFirst({
        where: { isCash: false, buildingType: building.type, buildings: { none: {} } },
        orderBy: { name: "asc" },
      });
  const pm = specific ?? fallback;
  const paymentMethod = pm
    ? {
        id: pm.id,
        name: pm.name,
        bankName: pm.bankName,
        accountHolder: pm.accountHolder,
        accountNumber: pm.accountNumber,
        qrCodeUrl: pm.qrCodeUrl,
      }
    : null;

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
          buildingName={building.name}
          buildingAddress={building.address}
          settingFallback={settingFallback}
          canWrite={canWrite}
          canSend={canSend}
          paymentMethod={paymentMethod}
          paymentMethods={paymentMethodsForEdit}
        />
      </PageBody>
    </AppShell>
  );
}
