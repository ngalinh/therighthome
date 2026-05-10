import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RevenueTab } from "./revenue-tab";
import { DebtTab } from "./debt-tab";
import { CashbookTab } from "./cashbook-tab";
import { PnLTab } from "./pnl-tab";

export default async function FinancePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string; year?: string; range?: string; from?: string; to?: string }>;
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
  const tab = sp.tab ?? "revenue";
  const range = sp.range ?? "month";
  const fromDate = sp.from ?? null;
  const toDate = sp.to ?? null;

  const [categories, paymentMethods, partyKindConfigs] = await Promise.all([
    prisma.transactionCategory.findMany({
      where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.paymentMethod.findMany({
      where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
      orderBy: { name: "asc" },
    }),
    prisma.partyKindConfig.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader title="Tài chính" description={building.name} />

      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 mb-4">
            <TabsList className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
              {[
                { value: "revenue", label: "Sổ Thu" },
                { value: "debt", label: "Sổ Chi" },
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

          <TabsContent value="revenue">
            <RevenueTab
              buildingId={id}
              month={month}
              year={year}
              categories={categories}
              paymentMethods={paymentMethods}
              partyKindConfigs={partyKindConfigs}
              canWrite={canWrite}
            />
          </TabsContent>
          <TabsContent value="debt">
            <DebtTab
              buildingId={id}
              month={month}
              year={year}
              categories={categories}
              paymentMethods={paymentMethods}
              partyKindConfigs={partyKindConfigs}
              canWrite={canWrite}
            />
          </TabsContent>
          <TabsContent value="cashbook">
            <CashbookTab buildingId={id} month={month} year={year} paymentMethods={paymentMethods} partyKindConfigs={partyKindConfigs} />
          </TabsContent>
          <TabsContent value="pnl">
            <PnLTab buildingId={id} range={range} from={fromDate} to={toDate} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
