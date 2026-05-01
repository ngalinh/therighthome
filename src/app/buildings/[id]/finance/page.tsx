import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionsTab } from "./transactions-tab";
import { RevenueTab } from "./revenue-tab";
import { DebtTab } from "./debt-tab";
import { CashbookTab } from "./cashbook-tab";
import { PnLTab } from "./pnl-tab";
import { serializeBigInt } from "@/lib/utils";

export default async function FinancePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string; year?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) notFound();
  const canWrite = await can(session.user.id, session.user.role, id, "finance.write");

  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());
  const tab = sp.tab ?? "transactions";

  const [categories, paymentMethods, parties, customers] = await Promise.all([
    prisma.transactionCategory.findMany({
      where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.paymentMethod.findMany({
      where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: { buildingId: id },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isChdv = building.type === "CHDV";

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      {/* Gradient page header */}
      <div className={`relative overflow-hidden ${isChdv ? "bg-gradient-chdv" : "bg-gradient-vp"} text-white px-4 lg:px-8 py-5`}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-0.5">{building.name}</p>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Tài chính</h1>
        </div>
      </div>

      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 mb-4">
            <TabsList className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
              {[
                { value: "transactions", label: "Giao dịch" },
                { value: "revenue", label: "Doanh thu" },
                { value: "debt", label: "Công nợ" },
                { value: "cashbook", label: "Sổ quỹ" },
                { value: "pnl", label: "KQKD" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-lg text-sm font-medium px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="transactions">
            <TransactionsTab
              buildingId={id}
              month={month}
              year={year}
              categories={categories}
              paymentMethods={paymentMethods}
              parties={parties}
              customers={customers}
              canWrite={canWrite}
            />
          </TabsContent>
          <TabsContent value="revenue">
            <RevenueTab buildingId={id} month={month} year={year} />
          </TabsContent>
          <TabsContent value="debt">
            <DebtTab buildingId={id} month={month} year={year} />
          </TabsContent>
          <TabsContent value="cashbook">
            <CashbookTab buildingId={id} month={month} year={year} paymentMethods={paymentMethods} />
          </TabsContent>
          <TabsContent value="pnl">
            <PnLTab buildingId={id} month={month} year={year} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
