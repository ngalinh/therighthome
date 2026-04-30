import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuildingSettingsForm } from "./settings-form";
import { OpeningBalancesForm } from "./opening-balances-form";
import { serializeBigInt } from "@/lib/utils";

export default async function BuildingSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({ where: { id }, include: { setting: true } });
  if (!building) notFound();
  const canWriteSettings = await can(session.user.id, session.user.role, id, "settings.write");
  const canWriteFinance = await can(session.user.id, session.user.role, id, "finance.write");

  const [paymentMethods, openings, customers, parties] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { OR: [{ buildingType: building.type }, { buildingType: null }] },
      orderBy: { name: "asc" },
    }),
    prisma.openingBalance.findMany({
      where: { buildingId: id },
      include: { customer: true, party: true },
      orderBy: [{ asOfYear: "desc" }, { asOfMonth: "desc" }],
    }),
    prisma.customer.findMany({
      where: { buildingId: id },
      select: { id: true, fullName: true, companyName: true },
    }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader title="Cài đặt" description={building.name} gradient={building.type === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">Chung</TabsTrigger>
            <TabsTrigger value="opening">Số dư đầu kỳ</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <BuildingSettingsForm
              buildingId={id}
              buildingType={building.type}
              setting={serializeBigInt(building.setting)}
              canWrite={canWriteSettings}
            />
          </TabsContent>
          <TabsContent value="opening">
            <OpeningBalancesForm
              buildingId={id}
              openings={serializeBigInt(openings)}
              paymentMethods={paymentMethods}
              customers={customers}
              parties={parties}
              canWrite={canWriteFinance}
            />
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
