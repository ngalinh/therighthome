import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { InvoicesView } from "./invoices-view";
import { serializeBigInt } from "@/lib/utils";

export default async function InvoicesPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) notFound();
  const canWrite = await can(session.user.id, session.user.role, id, "invoice.write");
  const canSend = await can(session.user.id, session.user.role, id, "invoice.send");

  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());

  const invoices = await prisma.invoice.findMany({
    where: {
      buildingId: id,
      month,
      year,
      ...(sp.status && sp.status !== "ALL" ? { status: sp.status as never } : {}),
    },
    include: {
      contract: {
        include: {
          room: true,
          customers: { include: { customer: true }, where: { isPrimary: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { contract: { room: { number: "asc" } } }],
  });

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader title="Hoá đơn" description={building.name} gradient={building.type === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <InvoicesView
          buildingId={id}
          buildingType={building.type}
          month={month}
          year={year}
          status={sp.status ?? "ALL"}
          invoices={serializeBigInt(invoices)}
          paymentMethods={paymentMethods}
          canWrite={canWrite}
          canSend={canSend}
        />
      </PageBody>
    </AppShell>
  );
}
