import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings, can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serializeBigInt } from "@/lib/utils";
import type { InvoiceStatus } from "@prisma/client";
import { ManageTasksTab } from "./tasks-tab";
import { ManageOvertimeTab } from "./overtime-tab";
import { AggregatedInvoicesView } from "./aggregated-invoices-view";
import { AggregatedTransactionsClient } from "./aggregated-transactions-client";
import { generateMonthlyInvoices } from "@/lib/invoice-service";

export async function ManageTypePage({
  kind,
  searchParams,
}: {
  kind: "CHDV" | "VP";
  searchParams: {
    tab?: string;
    month?: string;
    year?: string;
    status?: string;
    building?: string;
    room?: string;
  };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const accessible = await listAccessibleBuildings(session.user.id, session.user.role);
  const buildings = accessible.filter((b) => b.type === kind);
  const buildingIds = buildings.map((b) => b.id);

  const tab = searchParams.tab ?? "tasks";
  const now = new Date();
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const year = Number(searchParams.year ?? now.getFullYear());
  const status = searchParams.status ?? "ALL";
  const buildingFilter = searchParams.building ?? "ALL";
  const roomFilter = searchParams.room ?? "ALL";

  // Permission set: any building the user can write finance / invoices in.
  const writeChecks = await Promise.all(
    buildingIds.map(async (id) => ({
      id,
      finance: await can(session.user.id, session.user.role, id, "finance.write"),
      invoice: await can(session.user.id, session.user.role, id, "invoice.write"),
      send: await can(session.user.id, session.user.role, id, "invoice.send"),
    })),
  );
  const canFinance = writeChecks.some((c) => c.finance);
  const canInvoice = writeChecks.some((c) => c.invoice);
  const canSend = writeChecks.some((c) => c.send);

  // Common: rooms + parties.
  const [rooms, parties] = await Promise.all([
    prisma.room.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
      select: { id: true, buildingId: true, number: true },
    }),
    prisma.party.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
  ]);

  // Tasks (always loaded — small).
  const tasks = await prisma.maintenanceTask.findMany({
    where: { buildingId: { in: buildingIds } },
    orderBy: { date: "desc" },
    include: {
      building: { select: { id: true, name: true, type: true } },
      room: { select: { id: true, number: true } },
      party: { select: { id: true, name: true, kind: true } },
      customer: { select: { id: true, fullName: true, companyName: true } },
    },
    take: 500,
  });

  // Overtime — only fetched for VP.
  const overtimes = kind === "VP"
    ? await prisma.overtimeRequest.findMany({
        where: { buildingId: { in: buildingIds } },
        orderBy: { date: "desc" },
        include: {
          building: { select: { id: true, name: true, type: true } },
          room: { select: { id: true, number: true } },
          invoice: { select: { id: true, code: true } },
        },
        take: 500,
      })
    : [];

  // Invoices (filtered by month/year/status/building/room).
  const targetBuildingIds = buildingFilter === "ALL" ? buildingIds : [buildingFilter].filter((id) => buildingIds.includes(id));

  // Lazy auto-generate for current/past months (idempotent), so the user
  // doesn't need to click "Tạo HĐ" — invoices appear automatically when
  // viewing a month that has active contracts.
  const isCurrentOrPast = year < now.getFullYear()
    || (year === now.getFullYear() && month <= now.getMonth() + 1);
  if (canInvoice && isCurrentOrPast) {
    for (const bId of targetBuildingIds) {
      await generateMonthlyInvoices(month, year, bId).catch((e) => {
        console.error("[manage/auto-generate] failed for", bId, year, month, e);
      });
    }
  }
  const invoices = await prisma.invoice.findMany({
    where: {
      buildingId: { in: targetBuildingIds },
      month,
      year,
      ...(status !== "ALL" ? { status: status as InvoiceStatus } : {}),
      ...(buildingFilter !== "ALL" && roomFilter !== "ALL"
        ? { contract: { roomId: roomFilter } }
        : {}),
    },
    include: {
      building: { select: { id: true, name: true } },
      contract: {
        include: {
          room: true,
          customers: { include: { customer: true }, where: { isPrimary: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { contract: { room: { number: "asc" } } }],
  });

  // Transactions (filtered by month/year/building).
  const transactions = await prisma.transaction.findMany({
    where: {
      buildingId: { in: targetBuildingIds },
      accountingYear: year,
      accountingMonth: month,
    },
    include: {
      building: { select: { id: true, name: true } },
      category: true,
      paymentMethod: true,
      customer: true,
      party: true,
    },
    orderBy: { date: "desc" },
  });

  // Categories + payment methods (shared across the type).
  const [categories, paymentMethods] = await Promise.all([
    prisma.transactionCategory.findMany({
      where: { OR: [{ buildingType: kind }, { buildingType: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.paymentMethod.findMany({
      where: { OR: [{ buildingType: kind }, { buildingType: null }] },
      orderBy: { name: "asc" },
    }),
  ]);

  // Customers across the type's buildings (for the create dialog).
  const customers = await prisma.customer.findMany({
    where: { buildingId: { in: buildingIds } },
    select: { id: true, buildingId: true, fullName: true, companyName: true },
    orderBy: { createdAt: "desc" },
  });

  const buildingsLite = buildings.map((b) => ({ id: b.id, name: b.name, type: b.type }));
  const tasksS = serializeBigInt(tasks);
  const overtimesS = serializeBigInt(overtimes);
  const partiesS = serializeBigInt(parties);
  const invoicesS = serializeBigInt(invoices);
  const transactionsS = serializeBigInt(transactions);

  const title = kind === "CHDV" ? "Quản lý — Căn hộ dịch vụ" : "Quản lý — Văn phòng";

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}>
      <PageHeader title={title} gradient={kind === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 mb-4">
            <TabsList className="inline-flex">
              <TabsTrigger value="tasks">Công việc</TabsTrigger>
              <TabsTrigger value="invoices">Hoá đơn</TabsTrigger>
              <TabsTrigger value="transactions">Giao dịch</TabsTrigger>
              {kind === "VP" && <TabsTrigger value="overtime">Làm ngoài giờ</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="tasks">
            <ManageTasksTab
              kind={kind}
              buildings={buildingsLite}
              rooms={rooms}
              parties={partiesS}
              tasks={tasksS}
            />
          </TabsContent>
          <TabsContent value="invoices">
            <AggregatedInvoicesView
              buildingType={kind}
              buildings={buildingsLite}
              rooms={rooms}
              month={month}
              year={year}
              status={status}
              buildingFilter={buildingFilter}
              roomFilter={roomFilter}
              invoices={invoicesS}
              paymentMethods={paymentMethods}
              canWrite={canInvoice}
              canSend={canSend}
            />
          </TabsContent>
          <TabsContent value="transactions">
            <AggregatedTransactionsClient
              buildingType={kind}
              buildings={buildingsLite}
              rooms={rooms}
              month={month}
              year={year}
              buildingFilter={buildingFilter}
              transactions={transactionsS}
              categories={categories}
              paymentMethods={paymentMethods}
              parties={partiesS}
              customers={customers}
              canWrite={canFinance}
            />
          </TabsContent>
          {kind === "VP" && (
            <TabsContent value="overtime">
              <ManageOvertimeTab
                buildings={buildingsLite}
                rooms={rooms}
                overtimes={overtimesS}
              />
            </TabsContent>
          )}
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
