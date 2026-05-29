import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { InvoicesView } from "./invoices-view";
import { serializeBigInt } from "@/lib/utils";
import { generateMonthlyInvoices } from "@/lib/invoice-service";

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
  const building = await prisma.building.findUnique({ where: { id }, include: { setting: true } });
  if (!building) notFound();
  const canWrite = await can(session.user.id, session.user.role, id, "invoice.write");
  const canSend = await can(session.user.id, session.user.role, id, "invoice.send");

  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());

  // Auto-generate invoices when viewing:
  // 1. The current month (always), or
  // 2. Next month — if today >= autoGenerateInvoiceDay (allows pre-generation
  //    so accountants can prepare and send invoices before the billing date).
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const autoDay = building.setting?.autoGenerateInvoiceDay ?? 0;
  const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const isNextMonthEarly = autoDay > 0 && now.getDate() >= autoDay
    && year === nextMonthYear && month === nextMonth;
  if (canWrite && (isCurrentMonth || isNextMonthEarly)) {
    await generateMonthlyInvoices(month, year, id).catch((e) => {
      console.error("[invoices/auto-generate] failed for", id, year, month, e);
    });
  }

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
    orderBy: [{ dueDate: "asc" }],
  });

  // Re-sort: OVERDUE first (oldest dueDate → most overdue at top), then
  // PENDING/PARTIAL by dueDate, then PAID, then CANCELLED.
  const STATUS_BUCKET: Record<string, number> = {
    OVERDUE: 0, PENDING: 1, PARTIAL: 1, PAID: 2, CANCELLED: 3,
  };
  invoices.sort((a, b) => {
    const ba = STATUS_BUCKET[a.status] ?? 9;
    const bb = STATUS_BUCKET[b.status] ?? 9;
    if (ba !== bb) return ba - bb;
    const ra = a.contract?.room?.number ?? "";
    const rb = b.contract?.room?.number ?? "";
    return ra.localeCompare(rb, "vi", { numeric: true });
  });

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
    orderBy: { name: "asc" },
  });

  // Active contracts in this building, used by the manual invoice dialog so
  // the user can pick a room and auto-fill the customer.
  const activeContracts = await prisma.contract.findMany({
    where: { buildingId: id, status: "ACTIVE" },
    include: {
      room: { select: { id: true, number: true } },
      customers: {
        where: { isPrimary: true },
        include: { customer: { select: { type: true, fullName: true, companyName: true } } },
      },
    },
  });
  const contractOptions = activeContracts
    .map((c) => {
      const cust = c.customers[0]?.customer;
      return {
        contractId: c.id,
        roomId: c.room.id,
        roomNumber: c.room.number,
        customerName: cust
          ? cust.type === "COMPANY"
            ? cust.companyName ?? ""
            : cust.fullName ?? ""
          : "",
      };
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "vi", { numeric: true }));

  // Income categories matching this building's type (for the Loại chi phí dropdown).
  const incomeCategories = await prisma.transactionCategory.findMany({
    where: {
      type: "INCOME",
      OR: [{ buildingType: building.type }, { buildingType: null }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
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
          contractOptions={contractOptions}
          incomeCategories={incomeCategories}
          canWrite={canWrite}
          canSend={canSend}
        />
      </PageBody>
    </AppShell>
  );
}
